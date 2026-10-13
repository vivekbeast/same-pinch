// POST /packs/:id/collect — finalise a pack: paid decision (D5), ₹ cap, ledger, XP, flame, badges.
// Idempotent: the summary is stored on the pack and returned on repeat calls.
import { and, eq, gte, sql } from "drizzle-orm";
import type { api, z } from "@shared";
import { db } from "../db/client.js";
import { answers, ledger, packRounds, packs, userDays, userRegions, users } from "../db/schema.js";
import { levelFor, nextFlame, streakEndingAt } from "../domain/rules.js";
import type { GameConfig } from "../domain/config.js";
import { AppError } from "../lib/errors.js";
import { addDays, daysBetween, localDay } from "../lib/time.js";
import { evaluateBadges } from "./badges.service.js";
import { getConfig } from "./config.service.js";
import { invalidateUser } from "./session.service.js";

type Summary = z.infer<typeof api.CollectResponse>;
type AnswerRow = typeof answers.$inferSelect;

/** Bot-like packs: too many sub-800 ms answers, or the same words on most rounds (docs/SECURITY.md T5). */
export function isSuspicious(rows: Pick<AnswerRow, "responseMs" | "words">[], abuse: GameConfig["abuse"]) {
  const fast = rows.filter((r) => r.responseMs != null && r.responseMs < abuse.fastResponseMs).length;
  if (fast >= abuse.fastRoundsToFlag) return true;
  const filled = rows.filter((r) => r.words.length);
  if (filled.length < 5) return false;
  const counts = new Map<string, number>();
  for (const r of filled) {
    const k = [...r.words].sort().join("|");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Math.max(...counts.values()) / filled.length > abuse.sameAnswerShare;
}

export async function collectPack(userId: string, packId: string): Promise<Summary> {
  const cfg = await getConfig();

  const summary = await db.transaction(async (tx) => {
    const [pack] = await tx
      .select()
      .from(packs)
      .where(and(eq(packs.id, packId), eq(packs.userId, userId)))
      .for("update");
    if (!pack) throw new AppError("NOT_FOUND");
    if (pack.collectedAt) return pack.summary as Summary;

    const rounds = await tx.select().from(answers).where(and(eq(answers.packId, packId), eq(answers.userId, userId)));
    const [{ size }] = (await tx
      .select({ size: sql<number>`count(*)::int` })
      .from(packRounds)
      .where(eq(packRounds.packId, packId))) as [{ size: number }];
    if (rounds.length < size) throw new AppError("PACK_INCOMPLETE");

    // Lock the player row: XP, flame and money change together.
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    const playedDay = localDay(new Date(Math.min(...rounds.map((r) => r.playedAt.getTime()))), u!.tz);
    const [day] = await tx
      .select()
      .from(userDays)
      .where(and(eq(userDays.userId, userId), eq(userDays.day, playedDay)))
      .for("update");

    // ----- Money: paid only within the daily pack cap and ₹ cap; held if the pack looks like a bot -----
    const flagged = isSuspicious(rounds, cfg.abuse);
    const paid = cfg.paid_enabled && (day?.paidPacks ?? 0) < cfg.packs.paidPerDay;
    const rawEarn = rounds.reduce((a, r) => a + r.earnPaise, 0);
    const earned = paid ? Math.max(0, Math.min(rawEarn, cfg.pay.dailyCapPaise - (day?.earnPaise ?? 0))) : 0;
    const ledgerStatus = earned > 0 ? (flagged ? "pending_review" : "credited") : null;
    if (ledgerStatus) {
      await tx.insert(ledger).values({ userId, kind: "earn", amountPaise: earned, status: ledgerStatus, packId });
    }

    // ----- XP & level -----
    const xpGained = rounds.reduce((a, r) => a + r.xp, 0) + cfg.xp.packBonus;
    const before = levelFor(u!.xp, cfg.levels);
    const after = levelFor(u!.xp + xpGained, cfg.levels);

    // ----- Flame -----
    const step = nextFlame({ flame: u!.flame, best: u!.flameBest, freezes: u!.freezes, lastPlayDay: u!.lastPlayDay }, playedDay, cfg.flame);
    let { flame, best } = step;
    let lastRepairDay = u!.lastRepairDay;
    const packsThatDay = (day?.packs ?? 0) + 1;

    // Repair (grace): the flame broke yesterday with no freeze → finishing 2 packs today restores it,
    // at most once per 30 days (docs/GAME_DESIGN.md §9).
    const yesterday = addDays(playedDay, -1);
    const repairCooldownOk = !lastRepairDay || daysBetween(lastRepairDay, playedDay) >= cfg.flame.repairCooldownDays;
    if (packsThatDay === cfg.flame.repairPacks && u!.lastPlayDay === playedDay && repairCooldownOk) {
      const history = await tx
        .select()
        .from(userDays)
        .where(and(eq(userDays.userId, userId), gte(userDays.day, addDays(playedDay, -400))));
      const map = new Map(history.map((d) => [d.day, { played: d.packs > 0, kept: d.freezeUsed || d.repaired }]));
      const brokeYesterday = !map.has(yesterday) && map.get(addDays(playedDay, -2))?.played;
      const before2 = streakEndingAt(map, addDays(playedDay, -2));
      if (brokeYesterday && before2 + 1 > flame) {
        flame = before2 + 1;
        best = Math.max(best, flame);
        lastRepairDay = playedDay;
        await tx.insert(userDays).values({ userId, day: yesterday, repaired: true }).onConflictDoUpdate({
          target: [userDays.userId, userDays.day],
          set: { repaired: true },
        });
      }
    }

    for (const d of step.frozenDays) {
      await tx
        .insert(userDays)
        .values({ userId, day: d, freezeUsed: true })
        .onConflictDoUpdate({ target: [userDays.userId, userDays.day], set: { freezeUsed: true } });
    }
    await tx
      .insert(userDays)
      .values({ userId, day: playedDay, packs: 1, paidPacks: paid ? 1 : 0, earnPaise: earned, xp: xpGained })
      .onConflictDoUpdate({
        target: [userDays.userId, userDays.day],
        set: {
          packs: sql`${userDays.packs} + 1`,
          paidPacks: sql`${userDays.paidPacks} + ${paid ? 1 : 0}`,
          earnPaise: sql`${userDays.earnPaise} + ${earned}`,
          xp: sql`${userDays.xp} + ${xpGained}`,
        },
      });

    await tx
      .update(users)
      .set({ xp: u!.xp + xpGained, flame, flameBest: best, freezes: step.freezes, lastPlayDay: step.lastPlayDay, lastRepairDay })
      .where(eq(users.id, userId));

    // ----- Map & badges -----
    const regions = await tx
      .select({ code: userRegions.stateCode })
      .from(userRegions)
      .where(and(eq(userRegions.userId, userId), gte(userRegions.firstAt, pack.createdAt)));
    const newBadges = await evaluateBadges(tx, userId, flame, u!.goldStreak);

    const result: Summary = {
      earnedPaise: earned,
      paid,
      ledgerStatus,
      xpGained,
      xpTotal: u!.xp + xpGained,
      level: { ...after, leveledUp: after.value > before.value },
      flame: { value: flame, increased: step.increased || flame > u!.flame, freezeUsed: step.frozenDays.length > 0, freezes: step.freezes },
      newBadges,
      newRegions: regions.map((r) => r.code) as Summary["newRegions"],
      pinches: rounds.filter((r) => r.result === "exact" || r.result === "bhasha").length,
      bhasha: rounds.filter((r) => r.result === "bhasha").length,
      misses: rounds.filter((r) => r.result === "miss" || r.result === "near").length,
    };

    await tx
      .update(packs)
      .set({ collectedAt: new Date(), playedDay, paid, flagged, summary: result })
      .where(eq(packs.id, packId));
    return result;
  });

  invalidateUser(userId);
  return summary;
}
