// Smart Chips (docs/DECISIONS.md D39): finish the word you're typing, in the language you're typing it.
// The list is plain words per language (no concept map — SECURITY T17), fetched once, cached offline.
import { useQuery } from "@tanstack/react-query";
import { normalize, type api as Contract, type Lang } from "@shared";
import { api } from "./api";

export const useWordList = () =>
  useQuery({
    queryKey: ["words"],
    queryFn: () => api("/words", { schema: "WordList" }),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: Infinity,
  });

export interface Suggestion {
  text: string;
  lang: Lang;
}

/**
 * Up to `max` completions for what's typed: words that start with it (whole word first), shorter first,
 * the player's own language breaking ties. Never a translation — only words that start the same way.
 */
export function suggest(list: Contract.WordList | undefined, typed: string, prefer: Lang, max = 4): Suggestion[] {
  const q = normalize(typed);
  if (!list || q.length < 2) return [];
  const out: (Suggestion & { score: number })[] = [];
  for (const [lang, words] of Object.entries(list.words) as [Lang, string[]][]) {
    for (const w of words) {
      if (!w.startsWith(q) || w === q) continue;
      out.push({ text: w, lang, score: w.length + (lang === prefer ? 0 : 0.5) + (w.includes(" ") ? 2 : 0) });
    }
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => a.score - b.score)
    .filter((s) => (seen.has(s.text) ? false : (seen.add(s.text), true)))
    .slice(0, max)
    .map(({ text, lang }) => ({ text, lang }));
}
