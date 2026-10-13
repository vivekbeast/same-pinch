// Packs: 5 photo rounds = 3 Pinch the Picture + 1 hidden gold photo + 1 vibe photo, shuffled (D40).
// Short on purpose — a pack ends while it's still fun. Question prompts live in the Daily challenge.
// Packs carry prompt metadata only — partner answers never leave the server before submit.
import { randomInt } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { api, z } from "@shared";
import { db } from "../db/client.js";
import { answers, packRounds, packs, prompts } from "../db/schema.js";
import type { GameConfig } from "../domain/config.js";
import { AppError } from "../lib/errors.js";
import type { SessionUser } from "../types.js";
import { hit } from "../middleware/rate-limit.js";
import { getConfig } from "./config.service.js";
import { burntFor, glosses, recomputeBurnt } from "./content.service.js";

type PackDto = z.infer<typeof api.Pack>;
type RoundDto = z.infer<typeof api.Round>;
type PromptRow = Pick<typeof prompts.$inferSelect, "id" | "kind" | "assetKey" | "textKey" | "textParams" | "isGold">;

const shuffle = <T>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Take `n` prompts, unseen ones first (random within each group). */
const takeFresh = (pool: PromptRow[], seen: Set<string>, n: number) =>
  [...shuffle(pool.filter((p) => !seen.has(p.id))), ...shuffle(pool.filter((p) => seen.has(p.id)))].slice(0, n);

export function assetFor(p: Pick<PromptRow, "kind" | "assetKey">): RoundDto["asset"] {
  if (!p.assetKey) return null;
  if (p.kind === "sound") return { src: `/prompts/${p.assetKey}.webm` };
  const v = (w: number) => `/prompts/${p.assetKey}-${w}.webp`;
  return { src: v(480), srcset: `${v(320)} 320w, ${v(480)} 480w, ${v(720)} 720w` };
}

function secondsFor(kind: PromptRow["kind"], cfg: GameConfig, user: SessionUser) {
  const base = kind === "sound" ? cfg.round.soundSeconds : cfg.round.seconds;
  return (user.settings as { moreTime?: boolean })?.moreTime ? base * 2 : base; // WCAG 2.2.1
}

/** Client-safe round DTO. Whitelisted fields only: is_gold / gold_concepts are never read here (T2). */
export async function roundDtos(promptRows: PromptRow[], user: SessionUser, cfg: GameConfig): Promise<RoundDto[]> {
  const burnt = await burntFor(db, promptRows.map((p) => p.id));
  const gloss = await glosses([...new Set([...burnt.values()].flatMap((s) => [...s]))]);
  return promptRows.map((p) => ({
    promptId: p.id,
    kind: p.kind,
    asset: assetFor(p),
    textKey: p.textKey,
    textParams: (p.textParams as RoundDto["textParams"]) ?? null,
    burnt: [...(burnt.get(p.id) ?? [])].map((c) => gloss.get(c) ?? c),
    seconds: secondsFor(p.kind, cfg, user),
  }));
}

const promptCols = {
  id: prompts.id,
  kind: prompts.kind,
  assetKey: prompts.assetKey,
  textKey: prompts.textKey,
  textParams: prompts.textParams,
  isGold: prompts.isGold,
};

export async function getPack(user: SessionUser, packId: string): Promise<PackDto> {
  const cfg = await getConfig();
  const [pack] = await db
    .select({ id: packs.id })
    .from(packs)
    .where(and(eq(packs.id, packId), eq(packs.userId, user.id)));
  if (!pack) throw new AppError("NOT_FOUND"); // 404, not 403: don't confirm other users' packs exist
  const rows = await db
    .select(promptCols)
    .from(packRounds)
    .innerJoin(prompts, eq(prompts.id, packRounds.promptId))
    .where(eq(packRounds.packId, packId))
    .orderBy(asc(packRounds.idx));
  const answered = await db
    .select({ promptId: answers.promptId })
    .from(answers)
    .where(and(eq(answers.packId, packId), eq(answers.userId, user.id)));
  return { packId, rounds: await roundDtos(rows, user, cfg), answered: answered.map((a) => a.promptId) };
}

/** POST /packs — a fresh pack, or the oldest open one when the player already holds `maxOpen`. */
export async function createPack(user: SessionUser): Promise<PackDto> {
  const cfg = await getConfig();
  const open = await db
    .select({ id: packs.id })
    .from(packs)
    .where(and(eq(packs.userId, user.id), isNull(packs.collectedAt)))
    .orderBy(asc(packs.createdAt));
  if (open.length >= cfg.packs.maxOpen) return getPack(user, open[0]!.id);

  // Only packs actually created count toward the hourly limit (D44). Handing back an open pack is free —
  // Home's offline prefetch and a resumed tab both land here and must never lock a player out.
  const { count, resetMs } = await hit(user.id, "packs-created", "1h");
  if (count > cfg.packs.perHour) {
    throw new AppError("RATE_LIMITED", undefined, { "Retry-After": String(Math.ceil(resetMs / 1000)) });
  }

  const pool = await db.select(promptCols).from(prompts).where(eq(prompts.active, true));
  const seenRows = await db
    .selectDistinct({ id: answers.promptId })
    .from(answers)
    .where(and(eq(answers.userId, user.id), gt(answers.receivedAt, sql`now() - interval '14 days'`)));
  const openRows = open.length
    ? await db.select({ id: packRounds.promptId }).from(packRounds).where(inArray(packRounds.packId, open.map((p) => p.id)))
    : [];
  const seen = new Set([...seenRows, ...openRows].map((r) => r.id));

  // Every round shows a photo: the game is pinching a picture (D39/D40).
  const normal = pool.filter((p) => !p.isGold && p.kind === "image");
  const gold = pool.filter((p) => p.isGold && p.kind === "image");
  const vibe = pool.filter((p) => p.kind === "vibe" && !p.isGold);
  const chosen = shuffle([
    ...takeFresh(normal, seen, cfg.packs.normalRounds),
    ...takeFresh(gold, seen, cfg.packs.goldRounds),
    ...takeFresh(vibe, seen, cfg.packs.vibeRounds),
  ]);
  const size = cfg.packs.normalRounds + cfg.packs.goldRounds + cfg.packs.vibeRounds;
  if (chosen.length !== size) throw new AppError("INTERNAL", "not enough active prompts");

  const packId = await db.transaction(async (tx) => {
    const [p] = await tx.insert(packs).values({ userId: user.id }).returning({ id: packs.id });
    await tx.insert(packRounds).values(chosen.map((c, idx) => ({ packId: p!.id, idx, promptId: c.id })));
    return p!.id;
  });

  await recomputeBurnt(chosen.map((c) => c.id), cfg.burn);
  return { packId, rounds: await roundDtos(chosen, user, cfg), answered: [] };
}
