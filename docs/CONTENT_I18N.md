# CONTENT_I18N.md — prompts, lexicon, languages, copy

## 1. Languages

| Code | Language | UI at launch | Matching | Font |
|---|---|---|---|---|
| en | English | ✅ | ✅ | Inter |
| hi | Hindi | ✅ | ✅ (Devanagari + romanised) | Noto Sans Devanagari |
| kn | Kannada | ✅ | ✅ (Kannada + romanised) | Noto Sans Kannada |
| ta | Tamil | ✅ (partial OK) | partial | Noto Sans Tamil |
| te, mr | Telugu, Marathi | later | later | Noto |

**Script detection** for a typed word (client, for the plate colour; server re-checks):

```ts
export function detectLang(word: string, fallback: Lang): Lang {
  if (/[ऀ-ॿ]/.test(word)) return "hi";   // Devanagari (also Marathi; disambiguate by UI lang)
  if (/[ಀ-೿]/.test(word)) return "kn";
  if (/[஀-௿]/.test(word)) return "ta";
  if (/[ఀ-౿]/.test(word)) return "te";
  return fallback === "en" ? "en" : fallback;      // Latin: user's choice (tap strip to switch)
}
```

## 2. Normalisation (same logic client-preview and server)

1. `word.normalize("NFC").trim().toLowerCase()`
2. Remove zero-width joiners only when not between Indic letters (keep ZWJ/ZWNJ inside Indic words).
3. Strip punctuation/emoji: `/[\p{P}\p{S}]/gu`.
4. Collapse internal spaces; max 24 chars.
5. English plural: trailing `s` stripped if the singular is in the lexicon.
6. Romanised Hindi/Kannada variants handled by lexicon rows (`chai`, `chay`, `chaai`), not by algorithmic transliteration (keeps it predictable).

## 3. Lexicon format

Source of truth: `content/lexicon/*.csv` → compiled into `seed.sql` by `scripts/build-lexicon.ts`.

```csv
concept_id,gloss,en,hi,hi_rom,kn,kn_rom,ta,ta_rom
c_dog,dog,"dog;puppy*","कुत्ता;कुत्ते","kutta;kutte","ನಾಯಿ","naayi;nayi","நாய்","naai;nai"
c_tea,tea,"tea;chai","चाय","chai;chaay","ಚಹಾ;ಟೀ","chaha;tea","தேநீர்;டீ","theneer;tea"
c_rain,rain,"rain;rainy","बारिश;वर्षा","baarish;barish","ಮಳೆ","male","மழை","mazhai"
```
- `;` separates synonyms. `*` marks a *related* (near-pinch) term → goes to `concept_edges` instead.
- Review rule: every row checked by one native speaker per language before merge.
- `lexicon_candidates` (pairs players matched across languages that aren't in the lexicon) reviewed weekly → this is how coverage grows.

**Low-information list** (`content/low_info.txt`): thing, stuff, nice, good, bad, ok, okay, photo, pic, picture, image, yes, no, idk, nothing, something, accha, theek, chennagide, sari, nalla… (+ single characters).

## 4. Prompt authoring

| Kind | Asset | Prompt text key | Good example | Bad example |
|---|---|---|---|---|
| image | 480 px WebP, square, ≤ 18 KB | `prompt.what_do_you_see` | Chai glass on a wet bench | Abstract art (no shared answer) |
| sound | 3–5 s Opus mono 24 kbps, ≤ 15 KB | `prompt.what_do_you_hear` | Pressure cooker whistle | Silence, music with lyrics (copyright) |
| vibe | image | `prompt.one_word_feeling` | Empty bus stop at night | Anything distressing |
| question | none | `prompt.q.<id>` | "Something you eat when it rains" | Political, religious, caste, personal-data questions |

Content rules:
- No people's faces that could be identified; no logos/brands; no text in images (avoids reading-level bias).
- Licence: own photos or CC0/public-domain sources, logged in `content/CREDITS.md` with source URL and licence.
- No politics, religion, caste, violence, alcohol, gambling, or anything unsafe for 16+.
- Every prompt needs ≥ 3 concepts in the lexicon that people are likely to say.
- Gold prompts: unambiguous (a single dog on a road) with 2–4 accepted concepts.

## 5. UI strings & `t()`

```ts
// src/lib/i18n.ts
import en from "@/locales/en.json";
type Key = keyof typeof en;
const loaders = { hi: () => import("@/locales/hi.json"), kn: () => import("@/locales/kn.json"), ta: () => import("@/locales/ta.json") };
let dict: Record<string,string> = en;
export async function setLang(l: Lang) { dict = l === "en" ? en : { ...en, ...(await loaders[l]()).default }; document.documentElement.lang = l; }
export function t(key: Key, params?: Record<string, string | number>) {
  let s = dict[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
```

- Plurals: separate keys `flame.days_one` / `flame.days_other`, chosen with `Intl.PluralRules`.
- Numbers & money: `new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` — lakh grouping, `₹62.40`.
- Dates: `Intl.DateTimeFormat(uiLang + "-IN", { weekday: "long", day: "numeric", month: "long" })` → "Tuesday, 13 October".
- Key naming: `screen.element.purpose` (`today.flame.cta_play`).

### Core copy (en)

```json
{
  "onboarding.1.title": "Think alike.\nGet paid.",
  "onboarding.1.sub": "Match a stranger's word. Earn for every match.",
  "onboarding.2.title": "Same thought.\nAny language.",
  "onboarding.2.sub": "Kannada, Hindi or English — a match is a match.",
  "onboarding.3.title": "2 minutes\na day.",
  "onboarding.3.sub": "Play 10 rounds. Keep your flame. Get paid fairly.",
  "onboarding.next": "Next",
  "onboarding.start": "Let's play",
  "onboarding.restore": "I already play — restore",
  "today.flame.title": "Day flame",
  "today.flame.sub_pending": "Play today to keep it",
  "today.flame.sub_safe": "Flame safe for today",
  "today.flame.cta_play": "Play 10 rounds",
  "play.prompt.drop": "Drop",
  "play.prompt.placeholder": "Type a word…",
  "play.reveal.pinch": "SAME PINCH!",
  "play.reveal.bhasha": "BHASHA PINCH!",
  "play.reveal.near": "Almost pinched!",
  "play.reveal.miss": "So close — next one!",
  "play.offline.saved": "Saved. We'll show the result when you're online.",
  "results.title": "Your pinches",
  "results.sub": "Every match was checked.",
  "results.collect": "Collect {amount} · +{xp} XP",
  "wallet.demo_banner": "Demo money — no real payouts yet",
  "wallet.how_pay": "₹0.50 per match, +₹0.25 for a Bhasha match, × your accuracy.",
  "settings.promise.title": "Fair Play Promise",
  "settings.promise.sub": "We pay for work, never for luck."
}
```

Hindi/Kannada/Tamil files are translated by native speakers; machine translation allowed only as a first draft marked for review.

## 6. Daily themes (rotation)

Mon *Food* · Tue *Monsoon & weather* · Wed *Sounds of the city* · Thu *Festivals & colours* (non-religious framing) · Fri *College life* · Sat *Travel* · Sun *Feelings (vibe)*.
