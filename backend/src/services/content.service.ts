// Lexicon resolution: raw words → normalised, language-checked, concept-mapped ScoredWords.
// The concept map never leaves the server (docs/SECURITY.md T17); only plain per-language word lists do,
// for Smart Chips (`wordList`).
import { createHash } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { detectLang, LANGS, normalize, type api, type Lang, type z } from "@shared";
import { db, type Tx } from "../db/client.js";
import { conceptEdges, concepts, lexicon, lowInfoWords, promptBurnt } from "../db/schema.js";
import type { ScoredWord } from "../domain/match.js";
import { TtlCache } from "../lib/cache.js";

type Exec = typeof db | Tx;

const staticCache = new TtlCache<unknown>(5 * 60_000, 10);

const lowInfoSet = () =>
  staticCache.getOrSet("lowinfo", async () => new Set((await db.select().from(lowInfoWords)).map((r) => r.term))) as Promise<Set<string>>;

const edgeSet = () =>
  staticCache.getOrSet("edges", async () => new Set((await db.select().from(conceptEdges)).map((e) => `${e.a}|${e.b}`))) as Promise<
    Set<string>
  >;

export async function relatedFn() {
  const edges = await edgeSet();
  return (a: string, b: string) => edges.has(a < b ? `${a}|${b}` : `${b}|${a}`);
}

/** English gloss per concept, for burnt chips and "India said: chai". */
export async function glosses(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: concepts.id, gloss: concepts.gloss }).from(concepts).where(inArray(concepts.id, ids));
  return new Map(rows.map((r) => [r.id, r.gloss]));
}

export async function burntFor(x: Exec, promptIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>(promptIds.map((id) => [id, new Set<string>()]));
  if (!promptIds.length) return out;
  const rows = await x.select().from(promptBurnt).where(inArray(promptBurnt.promptId, promptIds));
  for (const r of rows) out.get(r.promptId)?.add(r.conceptId);
  return out;
}

export interface WordIn {
  text: string;
  lang: Lang;
}

/**
 * Normalise and map words to concepts. `trustLang` is for stored partner answers (their language was
 * already decided). For fresh input, script wins over the claimed language; a Latin word takes the
 * claimed language if the lexicon knows it there, else the only language that knows it.
 */
export async function resolveWords(x: Exec, input: WordIn[], burnt: Set<string>, trustLang = false): Promise<ScoredWord[]> {
  const words: WordIn[] = [];
  for (const w of input) {
    const text = normalize(w.text);
    if (text && !words.some((x) => x.text === text)) words.push({ text, lang: w.lang });
  }
  if (!words.length) return [];

  const rows = await x
    .select({ term: lexicon.term, lang: lexicon.lang, conceptId: lexicon.conceptId })
    .from(lexicon)
    .where(inArray(lexicon.term, words.map((w) => w.text)));
  const low = await lowInfoSet();

  return words.map((w) => {
    const hits = rows.filter((r) => r.term === w.text);
    let lang = w.lang;
    if (!trustLang) {
      lang = detectLang(w.text, w.lang);
      if (lang === w.lang && !hits.some((h) => h.lang === lang)) {
        const langs = [...new Set(hits.map((h) => h.lang))];
        if (langs.length === 1) lang = langs[0]!;
      }
    }
    const inLang = hits.filter((h) => h.lang === lang);
    const conceptsOf = [...new Set((inLang.length ? inLang : hits).map((h) => h.conceptId))];
    return {
      text: w.text,
      lang,
      concepts: conceptsOf,
      lowInfo: low.has(w.text) || Array.from(w.text).length < 2,
      burnt: conceptsOf.some((c) => burnt.has(c)),
    };
  });
}

/**
 * Lazy Burnt Words job (docs/BACKEND.md §6): for prompts not checked in `recheckMinutes`, burn any
 * concept used by more than `threshold` of the last `windowAnswers` answers — only once there are
 * at least `minAnswers` answers (docs/DECISIONS.md D18).
 */
export async function recomputeBurnt(promptIds: string[], cfg: { windowAnswers: number; threshold: number; minAnswers: number; recheckMinutes: number }) {
  if (!promptIds.length) return;
  const ids = sql.join(promptIds.map((id) => sql`${id}::uuid`), sql`, `);
  await db.execute(sql`
    with due as (
      update prompts set burnt_checked_at = now()
      where id in (${ids})
        and (burnt_checked_at is null or burnt_checked_at < now() - make_interval(mins => ${cfg.recheckMinutes}::int))
      returning id
    ),
    recent as (
      select a.prompt_id, a.concept_ids,
             row_number() over (partition by a.prompt_id order by a.received_at desc) as rn
      from answers a join due on due.id = a.prompt_id
      where not a.flagged and cardinality(a.words) > 0
    ),
    win as (select prompt_id, concept_ids from recent where rn <= ${cfg.windowAnswers}::int),
    totals as (select prompt_id, count(*) as n from win group by prompt_id),
    freq as (
      select w.prompt_id, c.concept_id, count(*) as k
      from win w cross join lateral unnest(w.concept_ids) as c(concept_id)
      group by w.prompt_id, c.concept_id
    )
    insert into prompt_burnt (prompt_id, concept_id)
    select f.prompt_id, f.concept_id
    from freq f join totals t using (prompt_id)
    where t.n >= ${cfg.minAnswers}::int and f.k > ${cfg.threshold}::numeric * t.n
    on conflict do nothing`);
}

/**
 * Smart Chips (D39): every lexicon term, grouped by language, sorted, de-duplicated — and nothing else.
 * No concept ids, so a client can autocomplete within a language but can't translate across them (T17).
 */
export async function wordList(): Promise<z.infer<typeof api.WordList>> {
  return staticCache.getOrSet("wordlist", async () => {
    const rows = await db.selectDistinct({ term: lexicon.term, lang: lexicon.lang }).from(lexicon);
    const words: Partial<Record<Lang, string[]>> = {};
    for (const l of LANGS) words[l] = [];
    for (const r of rows) words[r.lang]!.push(r.term);
    for (const l of LANGS) words[l]!.sort();
    const version = createHash("sha1").update(JSON.stringify(words)).digest("hex").slice(0, 12);
    return { version, words };
  }) as Promise<z.infer<typeof api.WordList>>;
}
