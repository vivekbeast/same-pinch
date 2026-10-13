// Think Like India (docs/GAME_DESIGN.md §10): 5 prompts, same for everyone on an IST date,
// one word each, graded against India's all-time answer distribution. XP only, never ₹.
import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { THEMES, type api, type DailyGrade, type z } from "@shared";
import { db } from "../db/client.js";
import { dailyAnswers, dailySetPrompts, dailySets, prompts, userDays, users } from "../db/schema.js";
import { DAILY_EMOJI, dailyGrade, dailyNumber } from "../domain/rules.js";
import { AppError } from "../lib/errors.js";
import { localDay } from "../lib/time.js";
import type { SessionUser } from "../types.js";
import { evaluateBadges } from "./badges.service.js";
import { getConfig } from "./config.service.js";
import { glosses, resolveWords } from "./content.service.js";
import { roundDtos } from "./pack.service.js";

type DailyDto = z.infer<typeof api.Daily>;
type DailyAnswerDto = z.infer<typeof api.DailyAnswer>;
export const IST = "Asia/Kolkata";
export const todayIst = () => localDay(new Date(), IST);

const promptCols = { id: prompts.id, kind: prompts.kind, assetKey: prompts.assetKey, textKey: prompts.textKey, textParams: prompts.textParams, isGold: prompts.isGold };

/** Deterministic set for a day: hash(day + id) order, today's theme first (Mon food … Sun feelings). */
async function ensureSet(day: string) {
  const cfg = await getConfig();
  const [existing] = await db.select().from(dailySets).where(eq(dailySets.day, day));
  if (!existing) {
    const eligible = await db.execute<{ id: string; theme: string | null }>(sql`
      select p.id, p.theme from prompts p
      where p.active and not p.is_gold and p.kind <> 'sound'
        and (select count(*) from answers a where a.prompt_id = p.id and cardinality(a.words) > 0) >= ${cfg.daily.minAnswers}::int`);
    const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const theme = THEMES[dow];
    const h = (id: string) => createHash("sha1").update(`${day}:${id}`).digest("hex");
    const ranked = [...eligible].sort((a, b) => Number(b.theme === theme) - Number(a.theme === theme) || h(a.id).localeCompare(h(b.id)));
    const chosen = ranked.slice(0, cfg.daily.size);
    if (chosen.length < cfg.daily.size) throw new AppError("INTERNAL", "not enough daily prompts");
    await db.transaction(async (tx) => {
      const ins = await tx
        .insert(dailySets)
        .values({ day, number: dailyNumber(day, cfg.daily.launchDay) })
        .onConflictDoNothing()
        .returning({ day: dailySets.day });
      if (ins.length) await tx.insert(dailySetPrompts).values(chosen.map((c, idx) => ({ day, idx, promptId: c.id })));
    });
  }
  const [set] = await db.select().from(dailySets).where(eq(dailySets.day, day));
  const rows = await db
    .select({ idx: dailySetPrompts.idx, ...promptCols })
    .from(dailySetPrompts)
    .innerJoin(prompts, eq(prompts.id, dailySetPrompts.promptId))
    .where(eq(dailySetPrompts.day, day))
    .orderBy(asc(dailySetPrompts.idx));
  return { set: set!, rows };
}

/** Concepts India said for a prompt, most common first, with share of answers. */
async function distribution(promptId: string) {
  const rows = await db.execute<{ concept_id: string; n: number; total: number }>(sql`
    with a as (select concept_ids from answers where prompt_id = ${promptId} and not flagged and cardinality(words) > 0)
    select c.concept_id, count(*)::int as n, (select count(*)::int from a) as total
    from a cross join lateral unnest(a.concept_ids) as c(concept_id)
    group by c.concept_id order by n desc, c.concept_id`);
  return rows.map((r) => ({ conceptId: r.concept_id, pct: r.total ? Math.round((100 * r.n) / r.total) : 0 }));
}

async function india(promptId: string) {
  const dist = await distribution(promptId);
  const top = dist[0];
  const gloss = top ? (await glosses([top.conceptId])).get(top.conceptId) : undefined;
  return { ranked: dist.map((d) => d.conceptId), india: top && gloss ? { text: gloss, pct: top.pct } : null };
}

export async function getDaily(user: SessionUser): Promise<DailyDto> {
  const cfg = await getConfig();
  const day = todayIst();
  const { set, rows } = await ensureSet(day);
  const mine = await db
    .select()
    .from(dailyAnswers)
    .where(and(eq(dailyAnswers.userId, user.id), eq(dailyAnswers.day, day)))
    .orderBy(asc(dailyAnswers.idx));
  const answersDto: DailyAnswerDto[] = [];
  for (const a of mine) {
    const promptId = rows.find((r) => r.idx === a.idx)!.id;
    answersDto.push({ idx: a.idx, word: a.word, lang: a.lang, grade: a.grade, india: (await india(promptId)).india });
  }
  return { day, number: set.number, prompts: await roundDtos(rows, user, cfg), answers: answersDto };
}

export async function answerDaily(user: SessionUser, day: string, idx: number, word: { text: string; lang: DailyAnswerDto["lang"] }) {
  if (day !== todayIst()) throw new AppError("STALE_ROUND");
  const cfg = await getConfig();
  const { rows } = await ensureSet(day);
  const prompt = rows.find((r) => r.idx === idx);
  if (!prompt) throw new AppError("NOT_FOUND");

  const [w] = await resolveWords(db, [word], new Set());
  if (!w) throw new AppError("INVALID_INPUT");
  const { ranked, india: top } = await india(prompt.id);
  // A word can map to several concepts; grade by its best-ranked one.
  const best = w.lowInfo ? null : (w.concepts.filter((c) => ranked.includes(c)).sort((a, b) => ranked.indexOf(a) - ranked.indexOf(b))[0] ?? w.concepts[0] ?? null);
  const grade: DailyGrade = dailyGrade(best, ranked);
  const xp = grade === "top" ? cfg.xp.dailyTop : grade === "top5" ? cfg.xp.dailyTop5 : 0;

  const newBadges = await db.transaction(async (tx) => {
    const ins = await tx
      .insert(dailyAnswers)
      .values({ userId: user.id, day, idx, word: w.text, lang: w.lang, conceptId: best, grade })
      .onConflictDoNothing()
      .returning({ idx: dailyAnswers.idx });
    if (!ins.length) throw new AppError("ALREADY_ANSWERED");
    const [u] = await tx
      .update(users)
      .set({ xp: sql`${users.xp} + ${xp}` })
      .where(eq(users.id, user.id))
      .returning({ flame: users.flame, goldStreak: users.goldStreak });
    if (xp) {
      // Daily XP counts toward the weekly leaderboard, but never toward the flame (packs only).
      await tx
        .insert(userDays)
        .values({ userId: user.id, day: localDay(new Date(), user.tz), xp })
        .onConflictDoUpdate({ target: [userDays.userId, userDays.day], set: { xp: sql`${userDays.xp} + ${xp}` } });
    }
    return evaluateBadges(tx, user.id, u!.flame, u!.goldStreak);
  });

  return { grade, india: top, xp, newBadges };
}

export async function shareText(user: SessionUser, day: string) {
  const [set] = await db.select().from(dailySets).where(eq(dailySets.day, day));
  if (!set) throw new AppError("NOT_FOUND");
  const mine = await db
    .select({ idx: dailyAnswers.idx, grade: dailyAnswers.grade })
    .from(dailyAnswers)
    .where(and(eq(dailyAnswers.userId, user.id), eq(dailyAnswers.day, day)))
    .orderBy(asc(dailyAnswers.idx));
  const grid = Array.from({ length: 5 }, (_, i) => DAILY_EMOJI[mine.find((m) => m.idx === i)?.grade ?? "none"]).join("");
  const score = mine.filter((m) => m.grade !== "none").length;
  return { text: `Same Pinch #${set.number} 🤏\n${grid}  ${score}/5\nsamepinch.vercel.app` };
}
