// The match engine (docs/GAME_DESIGN.md §3). Pure: lexicon lookups happen before, persistence after.
import type { Lang, RoundResult } from "@shared";

export interface ScoredWord {
  text: string; // normalised
  lang: Lang;
  concepts: string[]; // lexicon concepts for this word ([] = unknown word)
  lowInfo: boolean; // "nice", "thing" — never matches
  burnt: boolean; // concept is burnt for this prompt — dropped
}

export interface MatchOutcome {
  result: Exclude<RoundResult, "skipped">;
  /** Distinct match keys: concept ids, or "t:<text>" for identical unknown words. */
  matchKeys: string[];
  youMatched: boolean[];
  partnerMatched: boolean[];
  /** Unknown words in different languages on the same prompt → lexicon review queue. */
  unknownPairs: { a: { text: string; lang: Lang }; b: { text: string; lang: Lang } }[];
}

export const usable = (w: ScoredWord) => !w.lowInfo && !w.burnt;

/**
 * Tiers, best wins: Bhasha (same concept, different language) > Exact (same concept, same language,
 * or identical unknown word) > Near (concepts linked as related) > Miss.
 */
export function scoreRound(you: ScoredWord[], partner: ScoredWord[], related: (a: string, b: string) => boolean): MatchOutcome {
  // Translation stacking guard (D39): a concept you wrote in 2+ languages can't earn the Bhasha bonus —
  // otherwise "dog, कुत्ता, ನಾಯಿ" would be a guaranteed cross-language match.
  const youLangs = new Map<string, Set<Lang>>();
  for (const w of you.filter(usable)) for (const c of w.concepts) youLangs.set(c, (youLangs.get(c) ?? new Set()).add(w.lang));
  const youMatched = you.map(() => false);
  const partnerMatched = partner.map(() => false);
  const keys = new Set<string>();
  const unknownPairs: MatchOutcome["unknownPairs"] = [];
  let bhasha = false;
  let exact = false;
  let near = false;

  you.forEach((w, i) => {
    if (!usable(w)) return;
    partner.forEach((p, j) => {
      if (!usable(p)) return;
      const shared = w.concepts.filter((c) => p.concepts.includes(c));
      if (shared.length) {
        shared.forEach((c) => keys.add(c));
        youMatched[i] = partnerMatched[j] = true;
        if (w.lang === p.lang || shared.some((c) => (youLangs.get(c)?.size ?? 0) > 1)) exact = true;
        else bhasha = true;
        return;
      }
      if (!w.concepts.length && !p.concepts.length) {
        if (w.text === p.text) {
          keys.add(`t:${w.text}`);
          youMatched[i] = partnerMatched[j] = true;
          exact = true;
        } else if (w.lang !== p.lang) {
          unknownPairs.push({ a: { text: w.text, lang: w.lang }, b: { text: p.text, lang: p.lang } });
        }
        return;
      }
      if (w.concepts.some((a) => p.concepts.some((b) => related(a, b)))) near = true;
    });
  });

  const result = bhasha ? "bhasha" : exact ? "exact" : near ? "near" : "miss";
  return { result, matchKeys: [...keys], youMatched, partnerMatched, unknownPairs };
}

/**
 * Pinch the Picture (D39): two pinches are the "same spot" when they're within `radius` of each other on
 * the 0–1000 grid. Pure; the radius comes from config (`pinch.sameSpot`).
 */
export function samePinch(a: { x: number; y: number }, b: { x: number; y: number }, radius: number) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= radius;
}
