// Seeds reference data, content (concepts, lexicon, prompts), seeded partner answers and the demo account.
// Idempotent: content is upserted by stable keys; seed/demo users are replaced on every run.
// Real users and their data are never touched.   npm run db:seed
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, or, sql } from "drizzle-orm";
import { LANGS, LEVELS, REGIONS, normalize, type Lang } from "@shared";
import * as s from "../schema";
import { hashSecret, stableId } from "../../lib/crypto";
import { addDays, localDay } from "../../lib/time";
import { CONCEPT_EDGES, LEXICON_TABLE, LOW_INFO_WORDS } from "./data/lexicon";
import { HOTSPOTS } from "./data/hotspots";
import { PROMPTS, type PromptSeed } from "./data/prompts";
import { BADGES, DEMO_USER, GAME_CONFIG, SEED_USERS, type SeedUser } from "./data/reference";


// ---------------------------------------------------------------------------
// Deterministic randomness: same seed → same data on every machine.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = mulberry32(20261013);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
const shuffle = <T>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};
/** Weighted pick of k distinct items; earlier items are more likely (weight 1/(i+1)). */
function pickLikely<T>(xs: readonly T[], k: number): T[] {
  const pool = xs.map((x, i) => ({ x, w: 1 / (i + 1) }));
  const out: T[] = [];
  while (out.length < k && pool.length) {
    let r = rng() * pool.reduce((a, p) => a + p.w, 0);
    const i = pool.findIndex((p) => (r -= p.w) <= 0);
    out.push(pool.splice(i === -1 ? pool.length - 1 : i, 1)[0]!.x);
  }
  return out;
}
/**
 * A believable pinch for a seeded partner (D39): near one of the photo's hand-marked hotspots (weighted),
 * with a little human wobble. Null for prompts that aren't photos or have no hotspots.
 */
function seedPinch(key: string): { x: number; y: number } | null {
  const spots = HOTSPOTS[key];
  if (!spots?.length) return null;
  let r = rng() * spots.reduce((a, h) => a + h[2], 0);
  const [hx, hy] = spots.find((h) => (r -= h[2]) < 0) ?? spots[0]!;
  const wobble = () => Math.round((rng() + rng() - 1) * 70); // ±70, centred
  const clamp = (v: number) => Math.min(1000, Math.max(0, v));
  return { x: clamp(hx + wobble()), y: clamp(hy + wobble()) };
}

const weighted = <K extends string>(w: Record<K, number>): K => {
  let r = rng() * Object.values<number>(w).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries<number>(w)) if ((r -= v) <= 0) return k as K;
  return Object.keys(w)[0] as K;
};

// ---------------------------------------------------------------------------
// Lexicon parsing
// ---------------------------------------------------------------------------
type Column = "en" | "hi" | "hi_rom" | "kn" | "kn_rom" | "ta" | "ta_rom";
const COLUMNS: Column[] = ["en", "hi", "hi_rom", "kn", "kn_rom", "ta", "ta_rom"];
const columnLang = (c: Column): Lang => c.replace("_rom", "") as Lang;

interface ConceptSeed {
  id: string;
  gloss: string;
  terms: Record<Column, string[]>; // display spellings, first = canonical
}

function parseLexicon(): ConceptSeed[] {
  const seen = new Set<string>();
  return LEXICON_TABLE.trim()
    .split("\n")
    .map((line, n) => {
      const cells = line.split("|").map((c) => c.trim());
      if (cells.length !== 9) throw new Error(`lexicon line ${n + 1}: expected 9 columns, got ${cells.length}`);
      const [id, gloss, ...rest] = cells as [string, string, ...string[]];
      if (seen.has(id)) throw new Error(`lexicon: duplicate concept ${id}`);
      seen.add(id);
      const terms = Object.fromEntries(
        COLUMNS.map((c, i) => [c, (rest[i] ?? "").split(";").map((t) => t.trim()).filter(Boolean)]),
      ) as Record<Column, string[]>;
      if (!terms.en.length) throw new Error(`lexicon: ${id} has no English term`);
      return { id, gloss, terms };
    });
}

// ---------------------------------------------------------------------------
// Answer generation helpers
// ---------------------------------------------------------------------------
interface Word {
  text: string; // normalised
  lang: Lang;
  conceptId: string;
}

/** How a given person would write a concept: native script, romanised, or English. */
function wordFor(c: ConceptSeed, style: SeedUser["style"]): Word {
  const mode = weighted({ script: style.script, roman: style.roman, en: style.en });
  const lang: Lang = style.lang === "en" ? "hi" : style.lang; // English writers romanise Hindi
  const col: Column = mode === "en" ? "en" : mode === "roman" ? (`${lang}_rom` as Column) : (lang as Column);
  const list = c.terms[col]?.length ? c.terms[col] : c.terms.en;
  const usedCol = c.terms[col]?.length ? col : "en";
  return { text: normalize(list[0]!), lang: columnLang(usedCol), conceptId: c.id };
}

/** The same concept written in a *different* language than `not` (for Bhasha pinches). */
function otherLangWord(c: ConceptSeed, not: Lang): Word | null {
  const options = (["kn", "en", "hi", "ta"] as Column[]).filter((col) => columnLang(col) !== not && c.terms[col].length);
  if (!options.length) return null;
  const col = pick(options);
  return { text: normalize(c.terms[col][0]!), lang: columnLang(col), conceptId: c.id };
}

const textKeyFor = (p: PromptSeed) =>
  p.kind === "question" ? `prompt.q.${p.key}` : p.kind === "vibe" ? "prompt.one_word_feeling" : p.kind === "sound" ? "prompt.what_do_you_hear" : "prompt.what_do_you_see";

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export async function runSeed({ url, pepper, quiet = false }: { url: string; pepper: string; quiet?: boolean }) {
  rng = mulberry32(20261013);
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });

  const concepts = parseLexicon();
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const need = (id: string, where: string) => {
    const c = byId.get(id);
    if (!c) throw new Error(`${where}: unknown concept ${id}`);
    return c;
  };
  for (const [a, b] of CONCEPT_EDGES) [a, b].forEach((id) => need(id, `edge ${a}~${b}`));
  for (const p of PROMPTS) [...p.likely, ...(p.gold ?? []), ...(p.burnt ?? [])].forEach((id) => need(id, `prompt ${p.key}`));
  if (new Set(PROMPTS.map((p) => p.key)).size !== PROMPTS.length) throw new Error("duplicate prompt key");

  const now = new Date();
  const today = localDay(now, "Asia/Kolkata");
  const atDay = (day: string, hour: number, minute = 0) => new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
  const stats: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // ---------- Reference ----------
    await tx
      .insert(s.regions)
      .values(REGIONS.map((r) => ({ code: r.code, name: r.name, kind: r.kind, zone: r.zone })))
      .onConflictDoUpdate({ target: s.regions.code, set: { name: sql`excluded.name`, kind: sql`excluded.kind`, zone: sql`excluded.zone` } });

    await tx
      .insert(s.gameConfig)
      .values(Object.entries(GAME_CONFIG).map(([key, value]) => ({ key, value })))
      .onConflictDoUpdate({ target: s.gameConfig.key, set: { value: sql`excluded.value`, updatedAt: sql`now()` } });

    await tx
      .insert(s.badges)
      .values(BADGES.map((b) => ({ id: b.id, sort: b.sort, rule: b.rule, nameKey: `badge.${b.id}` })))
      .onConflictDoUpdate({ target: s.badges.id, set: { sort: sql`excluded.sort`, rule: sql`excluded.rule`, nameKey: sql`excluded.name_key` } });

    await tx.delete(s.lowInfoWords);
    await tx.insert(s.lowInfoWords).values([...new Set(LOW_INFO_WORDS.map(normalize))].map((term) => ({ term })));

    // ---------- Concepts & lexicon (content tables: replaced wholesale except concepts, which are upserted) ----------
    await tx
      .insert(s.concepts)
      .values(concepts.map((c) => ({ id: c.id, gloss: c.gloss })))
      .onConflictDoUpdate({ target: s.concepts.id, set: { gloss: sql`excluded.gloss` } });

    const lexRows = new Map<string, { term: string; lang: Lang; conceptId: string }>();
    for (const c of concepts)
      for (const col of COLUMNS)
        for (const raw of c.terms[col]) {
          const term = normalize(raw);
          if (Array.from(term).length < 2) continue;
          const lang = columnLang(col);
          lexRows.set(`${term}|${lang}|${c.id}`, { term, lang, conceptId: c.id });
        }
    await tx.delete(s.lexicon);
    for (const part of chunk([...lexRows.values()], 1000)) await tx.insert(s.lexicon).values(part);

    await tx.delete(s.conceptEdges);
    const edges = new Map<string, { a: string; b: string }>();
    for (const [x, y] of CONCEPT_EDGES) {
      const [a, b] = x < y ? [x, y] : [y, x];
      if (a !== b) edges.set(`${a}|${b}`, { a, b });
    }
    await tx.insert(s.conceptEdges).values([...edges.values()]);
    stats.concepts = concepts.length;
    stats.lexiconRows = lexRows.size;
    stats.edges = edges.size;

    // ---------- Prompts ----------
    const promptRows = PROMPTS.map((p) => ({
      id: stableId(`prompt:${p.key}`),
      kind: p.kind,
      assetKey: p.kind === "question" ? null : p.key,
      textKey: textKeyFor(p),
      theme: p.theme,
      isGold: !!p.gold,
      goldConcepts: p.gold ?? null,
      active: !p.inactive,
    }));
    await tx
      .insert(s.prompts)
      .values(promptRows)
      .onConflictDoUpdate({
        target: s.prompts.id,
        set: {
          kind: sql`excluded.kind`,
          assetKey: sql`excluded.asset_key`,
          textKey: sql`excluded.text_key`,
          theme: sql`excluded.theme`,
          isGold: sql`excluded.is_gold`,
          goldConcepts: sql`excluded.gold_concepts`,
          active: sql`excluded.active`,
        },
      });
    const promptIds = promptRows.map((p) => p.id);
    await tx.delete(s.promptBurnt).where(inArray(s.promptBurnt.promptId, promptIds));
    const burntRows = PROMPTS.flatMap((p) => (p.burnt ?? []).map((conceptId) => ({ promptId: stableId(`prompt:${p.key}`), conceptId })));
    if (burntRows.length) await tx.insert(s.promptBurnt).values(burntRows);
    stats.prompts = promptRows.length;
    stats.goldPrompts = PROMPTS.filter((p) => p.gold).length;
    stats.burnt = burntRows.length;

    // ---------- Replace seed + demo users (their answers first: answers outlive users otherwise) ----------
    const old = await tx
      .select({ id: s.users.id })
      .from(s.users)
      .where(or(eq(s.users.isSeed, true), eq(s.users.handle, DEMO_USER.handle)));
    if (old.length) {
      const ids = old.map((u) => u.id);
      await tx.update(s.answers).set({ partnerAnswerId: null }).where(inArray(s.answers.userId, ids));
      await tx.delete(s.answers).where(inArray(s.answers.userId, ids));
      await tx.delete(s.users).where(inArray(s.users.id, ids));
    }

    const seedUsers = SEED_USERS.map((u) => ({
      ...u,
      id: stableId(`seed-user:${u.handle}`),
      goldAcc: Math.round((0.72 + rng() * 0.25) * 100) / 100,
    }));
    await tx.insert(s.users).values(
      seedUsers.map((u) => ({
        id: u.id,
        handle: u.handle,
        avatar: u.avatar as (typeof s.avatarEnum.enumValues)[number],
        uiLang: (u.style.lang === "en" ? "en" : u.style.lang) as "en" | "hi" | "kn" | "ta",
        stateCode: u.state,
        city: u.city,
        isSeed: true,
        ageConfirmedAt: now,
        createdAt: new Date(now.getTime() - 60 * 86_400_000),
      })),
    );
    stats.seedUsers = seedUsers.length;

    // ---------- Seeded partner answers: 5 per prompt from different people/regions ----------
    type AnswerRow = typeof s.answers.$inferInsert;
    const seedAnswers: (AnswerRow & { _words: Word[] })[] = [];
    for (const p of PROMPTS) {
      const people = shuffle(seedUsers).slice(0, 5);
      people.forEach((person, i) => {
        const k = weighted({ 1: 0.3, 2: 0.45, 3: 0.25 });
        const words: Word[] = [];
        for (const cid of pickLikely(p.likely, Number(k))) {
          const w = wordFor(byId.get(cid)!, person.style);
          if (!words.some((x) => x.text === w.text)) words.push(w);
        }
        const playedAt = new Date(now.getTime() - (2 + rng() * 28) * 86_400_000);
        const pinch = p.kind === "image" ? seedPinch(p.key) : null;
        seedAnswers.push({
          pinchX: pinch?.x ?? null,
          pinchY: pinch?.y ?? null,
          id: stableId(`seed-answer:${p.key}:${i}`),
          userId: person.id,
          promptId: stableId(`prompt:${p.key}`),
          words: words.map((w) => w.text),
          langs: words.map((w) => w.lang),
          conceptIds: [...new Set(words.map((w) => w.conceptId))],
          authorState: person.state,
          authorGoldAcc: person.goldAcc,
          playedAt,
          receivedAt: playedAt,
          responseMs: 3_000 + Math.floor(rng() * 12_000),
          isSeed: true,
          _words: words,
        });
      });
    }
    for (const part of chunk(seedAnswers, 400)) await tx.insert(s.answers).values(part.map(({ _words, ...row }) => row));
    stats.seedAnswers = seedAnswers.length;

    // ---------- Demo account with ~10 days of believable history ----------
    const demoId = stableId(`demo-user:${DEMO_USER.handle}`);
    await tx.insert(s.users).values({
      id: demoId,
      handle: DEMO_USER.handle,
      avatar: DEMO_USER.avatar as (typeof s.avatarEnum.enumValues)[number],
      uiLang: DEMO_USER.uiLang,
      stateCode: DEMO_USER.state,
      city: DEMO_USER.city,
      restoreCodeHash: hashSecret(DEMO_USER.restoreCode, pepper),
      settings: { sound: true, vibration: true, dataSaver: false, moreTime: false, soundRounds: true, reminderAt: "20:00" },
      ageConfirmedAt: now,
      createdAt: atDay(addDays(today, -14), 18),
    });

    const pay = GAME_CONFIG.pay as { basePaise: number; bhashaBonusPaise: number };
    const xpCfg = GAME_CONFIG.xp as Record<string, number>;
    const multiplier = 1.2; // gold accuracy 0.7 → 0.5 + 0.7
    const demoStyle = { lang: "kn", script: 0.4, roman: 0.2, en: 0.4 } as const;
    const answersByPrompt = new Map<string, typeof seedAnswers>();
    for (const a of seedAnswers) answersByPrompt.set(a.promptId, [...(answersByPrompt.get(a.promptId) ?? []), a]);

    const DEMO_REGIONS = new Set(["KA", "TN", "MH", "DL", "ML", "KL", "WB", "UP", "TG", "GJ", "RJ", "AS", "PB", "GA"]);
    const normal = PROMPTS.filter((p) => !p.gold && p.kind !== "vibe");
    const gold = PROMPTS.filter((p) => p.gold);
    const vibes = PROMPTS.filter((p) => p.kind === "vibe");

    // Played days: a 3-day run that broke, then the current 7-day flame ending yesterday (today still open).
    const playedDays = [-11, -10, -9, -7, -6, -5, -4, -3, -2, -1].map((d) => addDays(today, d));
    const regionCounts = new Map<string, { count: number; first: Date }>();
    let totalXp = 0;
    let totalEarned = 0;
    let goldStreak = 0;
    let bhashaCount = 0;
    let multiMatch = false;
    let packNo = 0;

    for (const day of playedDays) {
      const packsToday = 2 + Math.floor(rng() * 2); // 2–3
      let dayXp = 0;
      let dayEarn = 0;
      for (let pi = 0; pi < packsToday; pi++) {
        const packId = stableId(`demo-pack:${packNo++}`);
        const rounds = shuffle([...shuffle(normal).slice(0, 8), pick(gold), pick(vibes)]);
        const startedAt = atDay(day, 8 + pi * 5, Math.floor(rng() * 50));
        const collectedAt = new Date(startedAt.getTime() + 3 * 60_000);
        let pinches = 0;
        let bhasha = 0;
        let misses = 0;
        let packXp = 0;
        let packEarn = 0;
        const rows: AnswerRow[] = [];

        rounds.forEach((p, idx) => {
          const promptId = stableId(`prompt:${p.key}`);
          // Demo partners come from 14 regions so the Sync Map has room to grow ("14 of 36").
          const pool = answersByPrompt.get(promptId)!;
          const local = pool.filter((a) => DEMO_REGIONS.has(a.authorState!));
          const partner = pick(local.length ? local : pool);
          let words: Word[];
          let result: AnswerRow["result"];
          let match: string[] = [];

          {
            const outcome = weighted({ exact: 0.45, bhasha: 0.2, miss: 0.35 });
            const shared = pick(partner._words);
            if (outcome === "exact") {
              words = [{ ...shared }];
              result = "exact";
              match = [shared.conceptId];
            } else if (outcome === "bhasha") {
              const w = otherLangWord(byId.get(shared.conceptId)!, shared.lang);
              words = w ? [w] : [{ ...shared }];
              result = w ? "bhasha" : "exact";
              match = [shared.conceptId];
            } else {
              const others = p.likely.filter((c) => !partner.conceptIds?.includes(c));
              words = others.length ? [wordFor(byId.get(pick(others))!, demoStyle)] : [{ text: "zigzag", lang: "en", conceptId: "" }];
              result = "miss";
            }
            // Sometimes add a second word; if it also matches it's a Double pinch.
            if (result !== "miss" && rng() < 0.3) {
              const second = partner._words.find((w) => w.conceptId !== match[0]);
              if (second) {
                words.push({ ...second });
                match.push(second.conceptId);
                multiMatch = true;
              }
            }
          }

          // Gold rounds were scored like any other; their hidden verdict is tracked separately.
          const goldCorrect = p.gold ? words.some((w) => p.gold!.includes(w.conceptId)) : null;
          if (goldCorrect !== null) goldStreak = goldCorrect ? goldStreak + 1 : 0;
          const isPinch = result === "exact" || result === "bhasha";
          const xp =
            result === "exact" ? xpCfg.exact! : result === "bhasha" ? xpCfg.bhasha! : xpCfg.miss!;
          const roundXp = xp + Math.max(0, match.length - 1) * xpCfg.extraMatch!;
          const earn = isPinch ? Math.round((pay.basePaise + (result === "bhasha" ? pay.bhashaBonusPaise : 0)) * multiplier) : 0;
          if (isPinch) {
            pinches++;
            if (result === "bhasha") {
              bhasha++;
              bhashaCount++;
            }
            const st = partner.authorState!;
            const prev = regionCounts.get(st);
            regionCounts.set(st, { count: (prev?.count ?? 0) + 1, first: prev?.first ?? startedAt });
          } else if (result === "miss") misses++;
          packXp += roundXp;
          packEarn += earn;

          const playedAt = new Date(startedAt.getTime() + idx * 15_000);
          rows.push({
            id: stableId(`demo-answer:${packId}:${idx}`),
            userId: demoId,
            packId,
            promptId,
            words: words.map((w) => w.text),
            langs: words.map((w) => w.lang),
            conceptIds: [...new Set(words.map((w) => w.conceptId).filter(Boolean))],
            authorState: DEMO_USER.state,
            authorGoldAcc: 0.7,
            playedAt,
            receivedAt: playedAt,
            responseMs: 2_500 + Math.floor(rng() * 9_000),
            partnerAnswerId: partner.id,
            result,
            matchConcepts: match,
            goldCorrect,
            xp: roundXp,
            earnPaise: earn,
          });
        });

        packXp += xpCfg.packBonus!;
        const summary = { earnedPaise: packEarn, paid: true, xpGained: packXp, pinches, bhasha, misses };
        await tx.insert(s.packs).values({ id: packId, userId: demoId, createdAt: startedAt, collectedAt, playedDay: day, paid: true, summary });
        await tx.insert(s.packRounds).values(rounds.map((p, idx) => ({ packId, idx, promptId: stableId(`prompt:${p.key}`) })));
        await tx.insert(s.answers).values(rows);
        if (packEarn > 0)
          await tx.insert(s.ledger).values({ userId: demoId, kind: "earn", amountPaise: packEarn, status: "credited", packId, createdAt: collectedAt });
        dayXp += packXp;
        dayEarn += packEarn;
      }
      await tx.insert(s.userDays).values({ userId: demoId, day, packs: packsToday, paidPacks: packsToday, earnPaise: dayEarn, xp: dayXp });
      totalXp += dayXp;
      totalEarned += dayEarn;
    }
    // The missed day inside the history (no freeze held yet → the earlier flame broke).
    stats.demoPacks = packNo;

    // One settled demo payout, if there's enough history to make it believable.
    if (totalEarned >= 8_000) {
      const payoutId = stableId("demo-payout:1");
      const at = atDay(addDays(today, -4), 21);
      await tx.insert(s.payouts).values({ id: payoutId, userId: demoId, amountPaise: 5_000, upiMasked: "r***@okaxis", status: "paid", createdAt: at, settledAt: new Date(at.getTime() + 60_000) });
      await tx.insert(s.ledger).values({ userId: demoId, kind: "payout", amountPaise: -5_000, status: "paid", payoutId, createdAt: at });
    }

    await tx.insert(s.userRegions).values([...regionCounts].map(([stateCode, r]) => ({ userId: demoId, stateCode, pinchCount: r.count, firstAt: r.first })));

    const badgeIds: (typeof s.badgeIdEnum.enumValues)[number][] = ["first_pinch", "fire_starter", "week_of_flames"];
    if (bhashaCount) badgeIds.push("bhasha_bridge");
    if (multiMatch) badgeIds.push("double_pinch");
    if (regionCounts.size >= 5) badgeIds.push("explorer");
    await tx.insert(s.userBadges).values(badgeIds.map((badgeId) => ({ userId: demoId, badgeId, earnedAt: atDay(addDays(today, -2), 20) })));

    await tx
      .update(s.users)
      .set({ xp: totalXp, flame: 7, flameBest: 7, freezes: 1, lastPlayDay: addDays(today, -1), goldStreak })
      .where(eq(s.users.id, demoId));

    // Stage 2/3: the demo account carries a verified identity so its simulated payouts are allowed.
    // Placeholder subject — nobody can sign in with it; reviewers use the restore code or "Try demo".
    await tx.insert(s.authIdentities).values({
      userId: demoId,
      provider: "google",
      subjectHash: hashSecret(`google:${DEMO_USER.googleSub}`, pepper),
      display: DEMO_USER.googleDisplay,
    });

    const level = [...LEVELS].reverse().find((l) => totalXp >= l.xp)!;
    stats.demoXp = totalXp;
    stats.demoLevel = level.value;
    stats.demoEarnedPaise = totalEarned;
    stats.demoRegions = regionCounts.size;
  });

  const [{ balance }] = (await client`
    select balance_paise as balance from user_balances where user_id = ${stableId(`demo-user:${DEMO_USER.handle}`)}`) as unknown as [{ balance: string }];
  stats.demoBalancePaise = Number(balance);
  await client.end();

  if (quiet) return stats;
  console.table(stats);
  console.log(`Demo login: restore code ${DEMO_USER.restoreCode} (handle ${DEMO_USER.handle}). Languages: ${LANGS.join(", ")}`);
  return stats;
}

// CLI: npm run db:seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  const pepper = process.env.SESSION_PEPPER;
  if (!url) throw new Error("DATABASE_URL is required");
  if (!pepper) throw new Error("SESSION_PEPPER is required (restore codes are hashed with it)");
  runSeed({ url, pepper }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
