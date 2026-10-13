// Profile changes, badges, data export and deletion (India DPDP rights — docs/SECURITY.md §6).
import { asc, eq, sql } from "drizzle-orm";
import type { api, z } from "@shared";
import { db } from "../db/client.js";
import { answers, badges, dailyAnswers, ledger, payouts, userBadges, userRegions, users } from "../db/schema.js";
import { AppError, pgCode } from "../lib/errors.js";
import { invalidateUser } from "./session.service.js";

type Patch = z.infer<typeof api.PatchMeInput>;

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export async function patchMe(userId: string, patch: Patch) {
  if (patch.tz !== undefined && !validTz(patch.tz)) throw new AppError("INVALID_INPUT");
  const { settings, ...rest } = patch;
  try {
    await db
      .update(users)
      .set({
        ...rest,
        ...(settings ? { settings: sql`${users.settings} || ${JSON.stringify(settings)}::jsonb` } : {}),
      })
      .where(eq(users.id, userId));
  } catch (e) {
    if (pgCode(e) === "23505") throw new AppError("HANDLE_TAKEN");
    throw e;
  }
  invalidateUser(userId);
}

export async function myBadges(userId: string) {
  const all = await db.select({ id: badges.id, nameKey: badges.nameKey, sort: badges.sort }).from(badges).orderBy(asc(badges.sort));
  const mine = await db.select({ id: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId));
  return { earned: mine.map((b) => b.id), all };
}

/** GET /me/export — everything we hold about the player, minus secrets (hashes) and other players. */
export async function exportMe(userId: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new AppError("NOT_FOUND");
  const { restoreCodeHash: _r, deviceHash: _d, isSeed: _s, ...profile } = u;
  return {
    exportedAt: new Date().toISOString(),
    profile,
    answers: await db
      .select({ id: answers.id, promptId: answers.promptId, words: answers.words, langs: answers.langs, result: answers.result, playedAt: answers.playedAt, xp: answers.xp, earnPaise: answers.earnPaise })
      .from(answers)
      .where(eq(answers.userId, userId)),
    ledger: await db.select().from(ledger).where(eq(ledger.userId, userId)),
    payouts: await db.select().from(payouts).where(eq(payouts.userId, userId)),
    badges: await db.select().from(userBadges).where(eq(userBadges.userId, userId)),
    regions: await db.select().from(userRegions).where(eq(userRegions.userId, userId)),
    daily: await db.select().from(dailyAnswers).where(eq(dailyAnswers.userId, userId)),
  };
}

/**
 * DELETE /me — the profile, sessions, ledger and progress are deleted (cascade); answers stay as
 * anonymous labels (user_id → null), as promised in Settings (docs/DATA_MODEL.md §4).
 */
export async function deleteMe(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
  invalidateUser(userId);
}
