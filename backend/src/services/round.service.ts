// POST /rounds — the client never decides a match (AGENTS.md #2). Everything happens here, in one
// transaction, with the pack row locked so double-submits serialise.
import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { HOT_HAND, LIMITS, PINCH_KINDS, type api, type Lang, type RoundResult, type z } from "@shared";
import { db, type Tx } from "../db/client.js";
import { answers, packRounds, packs, prompts, users } from "../db/schema.js";
import { samePinch, scoreRound, usable, type ScoredWord } from "../domain/match.js";
import { crowdHeat } from "../domain/crowd.js";
import { isHotRound, roundEarnPaise, roundXpWithSpot } from "../domain/rules.js";
import type { GameConfig } from "../domain/config.js";
import { AppError } from "../lib/errors.js";
import type { SessionUser } from "../types.js";
import { getConfig } from "./config.service.js";
import { secondsFor } from "./pack.service.js";
import { burntFor, relatedFn, resolveWords } from "./content.service.js";
import { getQuality } from "./player.service.js";

type Input = z.infer<typeof api.SubmitRoundInput>;
type RoundResponse = z.infer<typeof api.RoundResultResponse>;
type AnswerRow = typeof answers.$inferSelect;

const zipWords = (row: Pick<AnswerRow, "words" | "langs">) => row.words.map((text, i) => ({ text, lang: row.langs[i] as Lang }));
const isMatched = (w: ScoredWord, keys: string[]) => keys.includes(`t:${w.text}`) || w.concepts.some((c) => keys.includes(c));

/**
 * A recorded partner (docs/BACKEND.md §5): same prompt; not me, not my device, not flagged; prefer
 * authors with good gold accuracy; random among the most recent qualifying answers. On Pinch the Picture
 * rounds (D39) a partner who pinched is preferred, and a pinch-only answer qualifies. Sometimes
 * (`rematchChance`) someone you've pinched with before is preferred: a rematch.
 */
async function pickPartner(
  tx: Tx,
  promptId: string,
  userId: string,
  deviceHash: string | undefined,
  cfg: GameConfig,
  wantPinch: boolean,
) {
  const rows = await tx.execute<{ id: string; good: boolean; pinched: boolean; rematch: boolean }>(sql`
    with pals as (
      select distinct pa.user_id
      from answers me join answers pa on pa.id = me.partner_answer_id
      where me.user_id = ${userId} and me.result in ('exact', 'bhasha') and pa.user_id is not null
    )
    select a.id,
           coalesce(a.author_gold_acc, 0) >= ${cfg.partner.preferGoldAcc}::real as good,
           a.pinch_x is not null as pinched,
           a.user_id in (select user_id from pals) as rematch
    from answers a
    left join users u on u.id = a.user_id
    where a.prompt_id = ${promptId}
      and not a.flagged
      and (cardinality(a.words) > 0 or (${wantPinch}::boolean and a.pinch_x is not null))
      and (a.user_id is null or a.user_id <> ${userId})
      and (u.id is null or not u.is_flagged)
      and (${deviceHash ?? null}::text is null or a.author_device_hash is null or a.author_device_hash <> ${deviceHash ?? null})
    order by (${wantPinch}::boolean and a.pinch_x is not null) desc, good desc, a.received_at desc
    limit ${cfg.partner.recentPool}::int`);
  if (!rows.length) return null;
  // Pinch rounds want a partner who pinched; then careful answerers; fall back to anyone qualifying.
  const pinched = wantPinch ? rows.filter((r) => r.pinched) : rows;
  const base = pinched.length ? pinched : rows;
  const good = base.filter((r) => r.good);
  const fair = good.length ? good : base;
  const rematches = fair.filter((r) => r.rematch);
  const pool = rematches.length && randomInt(100) < cfg.partner.rematchChance * 100 ? rematches : fair;
  const id = pool[randomInt(pool.length)]!.id;
  const [row] = await tx.select().from(answers).where(eq(answers.id, id));
  return row ?? null;
}

/**
 * Build the response from stored rows. Used for fresh submits and idempotent replays alike, so both
 * return the same shape. Gold fields are never read into the DTO.
 */
async function present(tx: Tx, row: AnswerRow, cfg: GameConfig, newRegion: string | null = null): Promise<RoundResponse> {
  if (row.result === "skipped") {
    return { result: "skipped", you: [], partner: null, xp: 0, earnPaise: 0, newRegion: null, spot: null };
  }
  const burnt = (await burntFor(tx, [row.promptId])).get(row.promptId)!;
  const you = await resolveWords(tx, zipWords(row), burnt, true);
  const keys = row.matchConcepts;

  let partner: RoundResponse["partner"] = null;
  let partnerPinch: { x: number; y: number } | null = null;
  if (row.partnerAnswerId) {
    const [p] = await tx
      .select({
        words: answers.words,
        langs: answers.langs,
        state: answers.authorState,
        handle: users.handle,
        avatar: users.avatar,
        pinchX: answers.pinchX,
        pinchY: answers.pinchY,
        userId: answers.userId, // for the rematch count only; never serialised
      })
      .from(answers)
      .leftJoin(users, eq(users.id, answers.userId))
      .where(eq(answers.id, row.partnerAnswerId));
    if (p) {
      if (p.pinchX !== null && p.pinchY !== null) partnerPinch = { x: p.pinchX, y: p.pinchY };
      const pw = await resolveWords(tx, zipWords(p), burnt, true);
      partner = {
        handle: p.handle ?? "player", // anonymised after account deletion
        avatar: p.avatar ?? "a1",
        stateCode: (p.state as NonNullable<RoundResponse["partner"]>["stateCode"]) ?? null,
        words: pw.map((w) => ({ text: w.text, lang: w.lang, matched: isMatched(w, keys) })),
        together: p.userId && row.userId ? await pinchesBefore(tx, row, p.userId) : 0,
      };
    }
  }

  return {
    result: row.result!,
    you: you.map((w) => ({ text: w.text, lang: w.lang, matched: isMatched(w, keys), burnt: w.burnt })),
    partner,
    xp: row.xp,
    hot: row.hot,
    earnPaise: row.earnPaise,
    newRegion: (newRegion as RoundResponse["newRegion"]) ?? null,
    spot:
      row.pinchX !== null && row.pinchY !== null
        ? {
            you: { x: row.pinchX, y: row.pinchY },
            partner: partnerPinch,
            same: row.spotMatch === true,
            crowd: await crowdFor(tx, row, { x: row.pinchX, y: row.pinchY }, cfg),
          }
        : null,
  };
}

/** Pinches this player shared with that person before this answer (the rematch chip). */
async function pinchesBefore(tx: Tx, row: AnswerRow, partnerUserId: string) {
  const [r] = await tx.execute<{ n: number }>(sql`
    select count(*)::int as n
    from answers me join answers pa on pa.id = me.partner_answer_id
    where me.user_id = ${row.userId} and pa.user_id = ${partnerUserId}
      and me.id <> ${row.id} and me.received_at < ${row.receivedAt.toISOString()}::timestamptz
      and me.result in ('exact', 'bhasha') and not me.flagged`);
  return r?.n ?? 0;
}

/**
 * Where everyone else pinched on this photo. Called only from present(), i.e. after this player's answer
 * is stored, so nobody sees the crowd before committing (AGENTS.md #2).
 */
async function crowdFor(tx: Tx, row: AnswerRow, you: { x: number; y: number }, cfg: GameConfig) {
  const points = await tx.execute<{ x: number; y: number }>(sql`
    select pinch_x as x, pinch_y as y
    from answers
    where prompt_id = ${row.promptId} and not flagged and pinch_x is not null and id <> ${row.id}
      and (${row.userId}::uuid is null or user_id is null or user_id <> ${row.userId}::uuid)
    order by received_at desc
    limit ${cfg.crowd.window}::int`);
  return crowdHeat([...points], you, cfg.pinch.sameSpot, cfg.crowd);
}

export async function submitRound(user: SessionUser, deviceHash: string | undefined, input: Input): Promise<RoundResponse> {
  const cfg = await getConfig();
  const related = await relatedFn();

  return db.transaction(async (tx) => {
    // 1. Idempotency: the attempt id is the primary key.
    const [existing] = await tx.select().from(answers).where(eq(answers.id, input.attemptId));
    if (existing) {
      if (existing.userId !== user.id) throw new AppError("NOT_FOUND");
      return present(tx, existing, cfg);
    }

    // 2. Lock the pack → concurrent submits for the same pack serialise.
    const [pack] = await tx
      .select({ id: packs.id, collectedAt: packs.collectedAt })
      .from(packs)
      .where(and(eq(packs.id, input.packId), eq(packs.userId, user.id)))
      .for("update");
    if (!pack) throw new AppError("NOT_FOUND");
    if (pack.collectedAt) throw new AppError("STALE_ROUND");

    const [inPack] = await tx
      .select({ promptId: packRounds.promptId })
      .from(packRounds)
      .where(and(eq(packRounds.packId, pack.id), eq(packRounds.promptId, input.promptId)));
    if (!inPack) throw new AppError("NOT_FOUND");

    const [dup] = await tx
      .select({ id: answers.id })
      .from(answers)
      .where(and(eq(answers.userId, user.id), eq(answers.packId, pack.id), eq(answers.promptId, input.promptId)));
    if (dup) throw new AppError("ALREADY_ANSWERED");

    // 3. Offline rounds count for the day they were played, within limits (docs/SECURITY.md T9).
    const playedAt = new Date(input.playedAt);
    const age = Date.now() - playedAt.getTime();
    if (age > LIMITS.playedAtMaxAgeMs || age < -LIMITS.playedAtMaxFutureMs) throw new AppError("STALE_ROUND");

    const [prompt] = await tx
      .select({ id: prompts.id, kind: prompts.kind, isGold: prompts.isGold, goldConcepts: prompts.goldConcepts })
      .from(prompts)
      .where(eq(prompts.id, input.promptId));
    // A pinch only makes sense on a photo (D39).
    const pinchRound = PINCH_KINDS.includes(prompt!.kind);
    const pinch = input.pinch ?? null;
    if (pinch && !pinchRound) throw new AppError("INVALID_INPUT");
    const burnt = (await burntFor(tx, [prompt!.id])).get(prompt!.id)!;

    // 4. Words → concepts (server-side, same normalize() as the client preview).
    const you = await resolveWords(tx, input.words, burnt);
    const quality = await getQuality(tx, user.id, cfg);
    const base = {
      id: input.attemptId,
      userId: user.id,
      packId: pack.id,
      promptId: prompt!.id,
      words: you.map((w) => w.text),
      langs: you.map((w) => w.lang),
      conceptIds: [...new Set(you.filter(usable).flatMap((w) => w.concepts))],
      authorState: user.stateCode,
      authorDeviceHash: deviceHash ?? null,
      authorGoldAcc: quality.accuracy,
      playedAt,
      responseMs: input.responseMs,
      flagged: input.responseMs < cfg.abuse.fastResponseMs,
      pinchX: pinch?.x ?? null,
      pinchY: pinch?.y ?? null,
    };

    if (!you.length && !pinch) {
      const [row] = await tx.insert(answers).values({ ...base, result: "skipped", xp: 0, earnPaise: 0 }).returning();
      return present(tx, row!, cfg);
    }

    // 5. Score against a recorded partner. Gold rounds are scored identically (D22).
    const partner = await pickPartner(tx, prompt!.id, user.id, deviceHash, cfg, pinchRound);
    const partnerWords = partner ? await resolveWords(tx, zipWords(partner), burnt, true) : [];
    const outcome = scoreRound(you, partnerWords, related);
    const goldCorrect = prompt!.isGold
      ? you.filter(usable).some((w) => w.concepts.some((c) => prompt!.goldConcepts?.includes(c)))
      : null;

    // 6. Money + XP (pure, unit-tested). ₹ is provisional until collect (D5).
    // Same spot (D39) earns XP, never ₹ — a tap can land on the same spot by chance.
    const spotMatch =
      pinch && partner && partner.pinchX !== null && partner.pinchY !== null
        ? samePinch(pinch, { x: partner.pinchX, y: partner.pinchY }, cfg.pinch.sameSpot)
        : null;
    const earnPaise = cfg.paid_enabled ? roundEarnPaise(outcome.result, quality.multiplier, cfg.pay) : 0;
    // Hot hand: 3 pinches in a row in this pack put this round on half time for double XP. XP only, never ₹.
    const earlier = await tx
      .select({ result: answers.result })
      .from(answers)
      .where(and(eq(answers.userId, user.id), eq(answers.packId, pack.id)))
      .orderBy(answers.playedAt);
    const hot = isHotRound(
      earlier.map((a) => a.result as RoundResult),
      input.responseMs,
      secondsFor(prompt!.kind, cfg, user),
      HOT_HAND,
    );
    const xp = roundXpWithSpot(outcome.result, outcome.matchKeys.length, spotMatch === true, cfg) * (hot ? HOT_HAND.xpMult : 1);

    const [row] = await tx
      .insert(answers)
      .values({
        ...base,
        partnerAnswerId: partner?.id ?? null,
        result: outcome.result,
        matchConcepts: outcome.matchKeys,
        goldCorrect,
        xp,
        hot,
        earnPaise,
        spotMatch,
      })
      .returning();

    // 7. Side effects.
    if (goldCorrect !== null) {
      await tx
        .update(users)
        .set({ goldStreak: goldCorrect ? sql`${users.goldStreak} + 1` : 0 })
        .where(eq(users.id, user.id));
    }

    let newRegion: string | null = null;
    const isPinch = outcome.result === "exact" || outcome.result === "bhasha";
    if (isPinch && partner?.authorState && !base.flagged) {
      const r = await tx.execute<{ inserted: boolean }>(sql`
        insert into user_regions (user_id, state_code) values (${user.id}, ${partner.authorState})
        on conflict (user_id, state_code) do update set pinch_count = user_regions.pinch_count + 1
        returning (xmax = 0) as inserted`);
      if (r[0]?.inserted) newRegion = partner.authorState;
    }

    for (const { a, b } of outcome.unknownPairs) {
      const [x, y] = `${a.text}|${a.lang}` < `${b.text}|${b.lang}` ? [a, b] : [b, a];
      await tx.execute(sql`
        insert into lexicon_candidates (term_a, lang_a, term_b, lang_b)
        values (${x.text}, ${x.lang}, ${y.text}, ${y.lang})
        on conflict (term_a, lang_a, term_b, lang_b)
        do update set seen = lexicon_candidates.seen + 1, last_seen_at = now()`);
    }

    return present(tx, row!, cfg, newRegion);
  });
}
