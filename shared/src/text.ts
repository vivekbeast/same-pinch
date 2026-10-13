import { LIMITS, type Lang } from "./constants";

// Unicode blocks for the scripts we match (docs/CONTENT_I18N.md §1).
// Keep these as \u escapes: invisible/combining characters must never appear raw in source.
const DEVANAGARI = /[\u{0900}-\u{097F}]/u;
const KANNADA = /[\u{0C80}-\u{0CFF}]/u;
const TAMIL = /[\u{0B80}-\u{0BFF}]/u;
const TELUGU = /[\u{0C00}-\u{0C7F}]/u;
/** Any Indic letter or combining mark, Devanagari (U+0900) through Sinhala (U+0DFF). */
const INDIC = /[\u{0900}-\u{0DFF}]/u;

/**
 * Language of a typed word, from its script. Latin script can't be told apart
 * (dog / kutta / naayi), so it falls back to the player's choice; they can tap the plate strip to switch.
 */
export function detectLang(word: string, fallback: Lang): Lang {
  if (DEVANAGARI.test(word)) return fallback === "mr" ? "mr" : "hi";
  if (KANNADA.test(word)) return "kn";
  if (TAMIL.test(word)) return "ta";
  if (TELUGU.test(word)) return "te";
  return fallback;
}

const ZWJ = "\u{200D}";
const ZWNJ = "\u{200C}";
// Zero-width space, word joiner, BOM, soft hyphen, plus emoji leftovers that are marks rather than
// symbols: variation selectors, the keycap mark and flag tag characters.
// eslint-disable-next-line no-misleading-character-class -- intentionally matches lone combining marks to strip them
const ALWAYS_STRIP = /[\u{200B}\u{2060}\u{FEFF}\u{00AD}\u{FE00}-\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
const PUNCT_OR_SYMBOL = /[\p{P}\p{S}]/gu;

/**
 * Canonical form of a word, identical on client and server (docs/CONTENT_I18N.md §2):
 * NFC, trim, lowercase, drop invisible joiners (ZWJ/ZWNJ kept only inside Indic words),
 * strip punctuation and emoji, collapse spaces, cap at 24 characters.
 * Returns "" when nothing meaningful is left. Plural stripping needs the lexicon, so it happens server-side.
 */
export function normalize(input: string): string {
  let s = input.normalize("NFC").replace(ALWAYS_STRIP, "").toLowerCase();

  const chars = Array.from(s);
  s = chars
    .filter((ch, i) => {
      if (ch !== ZWJ && ch !== ZWNJ) return true;
      const prev = chars[i - 1] ?? "";
      const next = chars[i + 1] ?? "";
      return INDIC.test(prev) && INDIC.test(next);
    })
    .join("");

  s = s.replace(PUNCT_OR_SYMBOL, " ").replace(/\s+/gu, " ").trim();
  return Array.from(s).slice(0, LIMITS.maxWordLength).join("").trim();
}
