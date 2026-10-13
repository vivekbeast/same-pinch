// Wallet: balances, append-only ledger, demo payouts (docs/GAME_DESIGN.md §7, docs/SECURITY.md T15).
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { api, z } from "@shared";
import { db } from "../db/client.js";
import { ledger, packs, payouts, users } from "../db/schema.js";
import { maskUpi } from "../domain/rules.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "./config.service.js";
import { getBalance, getQuality, payoutEligibility } from "./player.service.js";

type LedgerItem = z.infer<typeof api.LedgerItem>;
type PayoutDto = z.infer<typeof api.Payout>;

/** Simulated mode only: pending payouts settle after ~60 s, lazily on the next wallet read (no workers). */
export async function settleDemoPayouts(userId: string) {
  const cfg = await getConfig();
  if (cfg.payout.mode !== "simulated") return;
  await db.transaction(async (tx) => {
    const settled = await tx
      .update(payouts)
      .set({ status: "paid", settledAt: new Date() })
      .where(
        and(
          eq(payouts.userId, userId),
          eq(payouts.status, "pending"),
          lt(payouts.createdAt, sql`now() - make_interval(secs => ${cfg.payout.demoSettleSeconds}::int)`),
        ),
      )
      .returning({ id: payouts.id });
    if (settled.length) {
      await tx
        .update(ledger)
        .set({ status: "paid" })
        .where(and(eq(ledger.kind, "payout"), inArray(ledger.payoutId, settled.map((s) => s.id))));
    }
  });
}

export async function getWallet(userId: string) {
  await settleDemoPayouts(userId);
  const cfg = await getConfig();
  const b = await getBalance(db, userId);
  const q = await getQuality(db, userId, cfg);
  return {
    balancePaise: b.balancePaise,
    pendingPaise: b.heldPaise + b.payoutPendingPaise,
    paidPaise: b.paidOutPaise,
    howPay: { basePaise: cfg.pay.basePaise, bhashaPaise: cfg.pay.bhashaBonusPaise, multiplier: q.multiplier },
  };
}

export async function ledgerPage(userId: string, cursor: number | undefined, limit: number) {
  const rows = await db
    .select({
      id: ledger.id,
      kind: ledger.kind,
      amountPaise: ledger.amountPaise,
      status: ledger.status,
      note: ledger.note,
      createdAt: ledger.createdAt,
      pinches: sql<number | null>`(${packs.summary} ->> 'pinches')::int`,
    })
    .from(ledger)
    .leftJoin(packs, eq(packs.id, ledger.packId))
    .where(and(eq(ledger.userId, userId), cursor ? lt(ledger.id, cursor) : undefined))
    .orderBy(desc(ledger.id))
    .limit(limit + 1);
  const items: LedgerItem[] = rows.slice(0, limit).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  return { items, nextCursor: rows.length > limit ? String(items[items.length - 1]!.id) : null };
}

const payoutDto = (p: typeof payouts.$inferSelect): PayoutDto => ({
  id: p.id,
  amountPaise: p.amountPaise,
  upiMasked: p.upiMasked,
  status: p.status,
  createdAt: p.createdAt.toISOString(),
  settledAt: p.settledAt?.toISOString() ?? null,
});

export async function listPayouts(userId: string) {
  await settleDemoPayouts(userId);
  const rows = await db.select().from(payouts).where(eq(payouts.userId, userId)).orderBy(desc(payouts.createdAt));
  return { items: rows.map(payoutDto) };
}

/**
 * POST /wallet/payouts — stage 3 gate, then reserve money atomically (player row locked, balance
 * re-checked inside the tx). Live payouts need KYC + a payout partner, which aren't built: they stay closed.
 */
export async function requestPayout(userId: string, amountPaise: number, upi: string) {
  const cfg = await getConfig();
  if (!cfg.paid_enabled || cfg.payout.mode === "disabled") throw new AppError("PAID_PAUSED");
  if (amountPaise < cfg.payout.minPaise) throw new AppError("MIN_PAYOUT");
  const eligibility = await payoutEligibility(db, userId, cfg);
  if (eligibility.needs.length) throw new AppError("VERIFICATION_REQUIRED");
  if (cfg.payout.mode === "live") throw new AppError("PAID_PAUSED"); // no payout partner integrated yet

  const payout = await db.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const b = await getBalance(tx, userId);
    if (b.balancePaise < amountPaise) throw new AppError("INSUFFICIENT_BALANCE");
    const [p] = await tx.insert(payouts).values({ userId, amountPaise, upiMasked: maskUpi(upi) }).returning();
    await tx.insert(ledger).values({ userId, kind: "payout", amountPaise: -amountPaise, status: "pending", payoutId: p!.id });
    return p!;
  });
  return { payout: payoutDto(payout) };
}
