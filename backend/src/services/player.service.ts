// Player state as the API shows it: Me DTO, balance, quality multiplier.
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import type { api, z } from "@shared";
import { db, type Tx } from "../db/client.js";
import { answers, userDays, users } from "../db/schema.js";
import type { GameConfig } from "../domain/config.js";
import { displayFlame, goldAccuracy, levelFor, qualityMultiplier } from "../domain/rules.js";
import { AppError } from "../lib/errors.js";
import { localDay } from "../lib/time.js";
import { getConfig } from "./config.service.js";
import { identitiesOf } from "./identity.service.js";

type Me = z.infer<typeof api.Me>;
type Exec = typeof db | Tx;

export async function getBalance(x: Exec, userId: string) {
  const rows = await x.execute<{ balance_paise: string; held_paise: string; payout_pending_paise: string; paid_out_paise: string }>(
    sql`select balance_paise, held_paise, payout_pending_paise, paid_out_paise from user_balances where user_id = ${userId}`,
  );
  const r = rows[0];
  return {
    balancePaise: Number(r?.balance_paise ?? 0),
    heldPaise: Number(r?.held_paise ?? 0),
    payoutPendingPaise: Number(r?.payout_pending_paise ?? 0),
    paidOutPaise: Number(r?.paid_out_paise ?? 0),
  };
}

/** Gold accuracy over the last 30 days → pay multiplier (docs/GAME_DESIGN.md §7). */
export async function getQuality(x: Exec, userId: string, cfg: GameConfig) {
  const [r] = await x
    .select({
      total: sql<number>`count(*)::int`,
      correct: sql<number>`count(*) filter (where ${answers.goldCorrect})::int`,
    })
    .from(answers)
    .where(and(eq(answers.userId, userId), isNotNull(answers.goldCorrect), gt(answers.receivedAt, sql`now() - interval '30 days'`)));
  const accuracy = goldAccuracy(r?.correct ?? 0, r?.total ?? 0, cfg.pay);
  return { accuracy, multiplier: qualityMultiplier(accuracy, cfg.pay) };
}

export async function getUser(x: Exec, userId: string) {
  const [u] = await x.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) throw new AppError("UNAUTHENTICATED");
  return u;
}

/**
 * Stage 3: what a player still needs before cashing out. Simulated payouts need a linked, verified
 * identity (Google);
 * live payouts also need KYC (not built yet, so live stays closed).
 */
export async function payoutEligibility(x: Exec, userId: string, cfg: GameConfig) {
  const u = await getUser(x, userId);
  const ids = await identitiesOf(userId);
  const needs: ("identity" | "kyc")[] = [];
  if (!ids.length) needs.push("identity");
  if (cfg.payout.mode === "live" && u.kycStatus !== "verified") needs.push("kyc");
  return { mode: cfg.payout.mode, eligible: cfg.paid_enabled && cfg.payout.mode !== "disabled" && needs.length === 0, needs };
}

/** The Me DTO (docs/API.md). Reads fresh rows — never the session cache. */
export async function buildMe(userId: string, restoreCode: string | null = null): Promise<Me> {
  const cfg = await getConfig();
  const u = await getUser(db, userId);
  const today = localDay(new Date(), u.tz);
  const [day] = await db
    .select({ paidPacks: userDays.paidPacks })
    .from(userDays)
    .where(and(eq(userDays.userId, userId), eq(userDays.day, today)));
  const balance = await getBalance(db, userId);
  const flame = displayFlame({ flame: u.flame, best: u.flameBest, freezes: u.freezes, lastPlayDay: u.lastPlayDay }, today);

  return {
    id: u.id,
    handle: u.handle,
    avatar: u.avatar,
    uiLang: u.uiLang,
    stateCode: (u.stateCode as Me["stateCode"]) ?? null,
    city: u.city,
    xp: u.xp,
    level: levelFor(u.xp, cfg.levels),
    flame: { value: flame.value, best: u.flameBest, freezes: u.freezes, safeToday: flame.safeToday },
    paidPacksLeftToday: cfg.paid_enabled ? Math.max(0, cfg.packs.paidPerDay - (day?.paidPacks ?? 0)) : 0,
    balancePaise: balance.balancePaise,
    pendingPaise: balance.heldPaise + balance.payoutPendingPaise,
    restoreCode,
    settings: (u.settings ?? {}) as Record<string, unknown>,
    identities: (await identitiesOf(userId)).map((i) => ({ provider: i.provider, display: i.display, linkedAt: i.verifiedAt.toISOString() })),
    payout: await payoutEligibility(db, userId, cfg),
  };
}
