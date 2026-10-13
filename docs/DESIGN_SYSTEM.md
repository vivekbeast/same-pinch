# DESIGN_SYSTEM.md — the Same Pinch look

The visual language is translated from the **RideLocker** reference screens: calm canvas, white rounded cards, one confident violet, near-black "hero" cards with one huge coloured number, condensed bold headlines, and very plain microcopy. Same Pinch keeps that discipline, **warms it up** (chai-cream canvas, plum-black night cards) and adds two playful accents: **Pinch Coral** for the moment of a match and **Marigold** for rewards.

> Rule of thumb: the screen is calm; the *pinch* is loud.

All tokens live in **one file: `src/styles/theme.css`** (§9). Every page and component reads from it. Changing a colour or font there changes the whole app.

---

## 1. Reference analysis → what we keep

| RideLocker pattern | Why it works | Same Pinch use |
|---|---|---|
| Full-bleed photo onboarding, dark bottom scrim, glass notification card mid-screen | Shows the *outcome* before asking for anything | Glass card: "Same Pinch · now — You & Asha (Meghalaya) both said *chai* 🤏" |
| Huge condensed 2-line headline + 1-line grey sub | Readable at a glance, few words | "Think alike. Get paid." |
| Pill page dots (active stretches) | Progress without text | Same |
| White full-width pill CTA + quiet text link with icon | One obvious action, one escape hatch | "Next" / "I already play — restore" |
| Glass "Skip" pill, logo tile top-left | Doesn't compete with the photo | Same |
| Calm canvas, page title condensed bold + grey date | Feels like a daily briefing | "Today · Tuesday, 13 October" |
| Round white icon buttons top-right | Secondary actions out of the way | Wallet + Settings (phone/tablet) |
| Violet gradient feature card with big soft circle + suggestion pills | Invites one action | "Think Like India #142" with today's prompt pills |
| Near-black card, giant coloured numeral, tinted chip, white pill CTA | One number tells the story | "**7** day flame · 2 freezes · Play 10 rounds →" |
| Section header with count bubble + "See all" | Scannable | "Today so far 6" |
| Row: tinted icon tile + title + coloured status + chevron | Status by colour **and** words | Ledger rows, results rows |
| **Indian number plate** chip (white, black border, blue IND strip) | Instantly local | **Bhasha Plate** word chip with language strip |
| Three stat tiles with icon top-right | Summary at a glance | Earned / Pending / Paid |
| Segmented control with count badges | Two views, one place | Earnings / Payouts (phone, tablet) |
| Filter chips, active = solid violet | Light filtering | City / State / India |
| Month-grouped timeline, big day number + small coloured month | Time readable without reading | Ledger by day |
| Status tiles: green *Valid*, grey dashed *Missing*, red *Expired* | Three states, three colours | Map: *Synced* / *Not yet* / *New!* |
| Bottom nav with centre elevated violet pill, active tab in a soft pill, red badge | Main action one thumb away | Today · Map · **Play** · Wallet · Pals |
| Bottom sheet with handle, dark hero option, soft tiles, 3-step stepper, lock line | Calm multi-step | "Ready to pinch?" sheet: See → Drop → Flip |
| Dark "Check what we read" card + "Looks right ✓" rows + "Confirm all 3" | Trust: nothing counts until confirmed | Results: "6 Pinched / 4 Missed" → "Collect ₹3.40" |
| Dark "Air-Gapped Vault" stats (green "0 B sent anywhere") | Policy as a proud number | **Fair Play Promise**: ₹0 deposits ever · ₹50 min payout · 24 h max wait |
| Grouped settings cards, inset dividers, violet toggles, violet values | Familiar, tidy | Same |
| Plain microcopy ("Looks right", "Stays on this phone") | ESL-friendly, warm | Our voice (§8) |

---

## 2. Colour — research and reasoning

**What the evidence actually says.** The most-cited review of colour psychology (Elliot, *Frontiers in Psychology*, 2015) finds that colour effects are real but **depend heavily on context**, that many studies are small and preliminary, and that red in achievement settings tends to push people toward caution and avoidance, while blue is linked to perceived trustworthiness. So we don't pretend a hex code "increases engagement by 30%". We use colour with these defensible principles:

1. **Trust for money, warmth for play.** A blue-leaning violet carries the "trust" signal for actions and money screens; warm accents (coral, marigold) carry play and celebration.
2. **No red while people are performing.** The round timer's warning colour is **marigold**, not red/coral, so the last seconds feel urgent but not threatening. Red is reserved for real problems (failed payout, errors).
3. **Cultural context.** In India, marigold/saffron tones read as festive and auspicious (garlands, celebrations) — a natural colour for rewards, coins, XP and badges.
4. **Warm neutrals reduce glare.** A cream canvas instead of pure white or cool grey is softer on cheap, bright-blue-ish LCD panels at night, and makes white cards "lift" without heavy shadows.
5. **Complementary energy, controlled.** Violet (≈ 255°) and marigold (≈ 40°) sit opposite on the colour wheel; coral sits next to marigold. This split-complementary scheme gives high energy at the moments that matter while the canvas stays calm. Accents cover **< 10%** of any screen.
6. **Contrast is non-negotiable.** Every text pair below is checked against WCAG AA (ratios computed, see table).

### Palette: "Chai & Marigold"

| Token | Hex | Role |
|---|---|---|
| `canvas` | `#F7F4EF` | App background (chai cream) |
| `surface` | `#FFFFFF` | Cards |
| `surface-2` | `#F0EBE3` | Inset panels, segmented track, skeletons |
| `line` | `#E8E1D6` | Dividers, hairlines |
| `ink` | `#1A1523` | Titles, primary text (plum-black) |
| `ink-2` | `#3D3547` | Body |
| `ink-muted` | `#6B6173` | Secondary text, dates, placeholders |
| `ink-faint` | `#9C92A0` | Decorative only (disabled icons, dots) — **never text** |
| `brand` | `#5A3BE7` | Primary actions, active states, links |
| `brand-600` | `#4529C9` | Pressed |
| `brand-400` | `#6E50F2` | Gradient start |
| `brand-soft` | `#EEE9FF` | Icon tiles, active tab pill, soft chips |
| `brand-ink` | `#33219A` | Text on `brand-soft` |
| `night` | `#1B1622` | Hero cards, onboarding (warm plum-black) |
| `night-2` | `#272030` | Rows inside night cards |
| `pinch` | `#FF7A6B` | Flame numeral, PINCH stamp (large, on night only) |
| `pinch-soft` | `#FFE9E4` | Soft coral backgrounds |
| `pinch-ink` | `#B8382A` | Coral text on light backgrounds |
| `marigold` | `#FFB020` | Coins, XP, rewards, timer warning (fills/icons) |
| `marigold-soft` | `#FFF3D6` | Reward chips, freeze chip |
| `marigold-ink` | `#9A5800` | Marigold text on light backgrounds |
| `success` | `#177245` | Positive text |
| `success-soft` | `#E5F5EC` | Synced / paid tiles |
| `success-bright` | `#5BE49B` | Positive numbers on night |
| `danger` | `#C0322B` | Errors, failed payouts |
| `danger-soft` | `#FDEBE9` | Error tiles |
| `lang-en/hi/kn/ta/te/mr` | `#1F4FBF` `#E8710A` `#C9A400` `#B3261E` `#0B8043` `#7B1FA2` | Bhasha Plate strips (decorative, always with a text code) |

### Contrast check (WCAG 2.x)

| Pair | Ratio | Use |
|---|---|---|
| ink on canvas | 16.3 | ✅ body/titles |
| ink-muted on canvas / white / surface-2 | 5.3 / 5.9 / 4.9 | ✅ secondary text |
| white on brand | 6.5 | ✅ buttons |
| white on brand-400 (lightest gradient stop) | 5.1 | ✅ gradient card text |
| brand on canvas | 6.0 | ✅ links |
| brand-ink on brand-soft | 9.7 | ✅ soft chips |
| pinch on night | 7.0 | ✅ numeral |
| marigold on night | 9.7 | ✅ reward numbers |
| success-bright on night | 11.0 | ✅ |
| marigold-ink on marigold-soft | 5.1 | ✅ |
| success on success-soft | 5.3 | ✅ |
| danger on danger-soft | 4.9 | ✅ |
| pinch-ink on pinch-soft | 5.0 | ✅ |
| ink on marigold | 9.8 | ✅ marigold buttons/badges |
| pinch on canvas | 2.3 | ❌ never as text on light — use `pinch-ink` |
| ink-faint on white | 3.0 | ❌ decoration only |

### Where each colour appears

- **Violet:** primary button, active nav, links, toggles, segmented pill, progress bars, gradient daily card.
- **Coral:** flame numeral, PINCH stamp, matched plate ring, 404 numeral. Nothing else.
- **Marigold:** ₹ and XP numbers/coins, reward chips, badges, timer warning ring, level-up confetti dots, freeze chip.
- **Green:** synced, paid, "safe for today".
- **Red:** errors and failed payouts only.

### Dark mode
MVP ships light-only (matches the reference, halves QA). Tokens are semantic; a `.dark` block can override them later. Night cards already give a dark "moment" inside the light theme.

---

## 3. Typography

| Role | Font | Weight | Phone → Desktop size/line | Tracking |
|---|---|---|---|---|
| Hero (onboarding) | Barlow Condensed | 700 | 52/54 → 72/72 | -0.01em |
| Page title | Barlow Condensed | 700 | 40/44 → 48/52 | -0.01em |
| Section title | Barlow Condensed | 700 | 28/32 → 30/34 | 0 |
| Card title | Barlow Condensed | 600 | 24/28 → 26/30 | 0 |
| Giant numeral | Barlow Condensed | 700 | 96/88 → 120/104 | -0.02em |
| Stat number | Barlow Condensed | 700 | 36/40 → 40/44 | 0 |
| Body | Inter | 400 | 16/24 → 16/26 | 0 |
| Body strong | Inter | 500/600 | 16/24 | 0 |
| Small | Inter | 400 | 14/20 | 0 |
| Plate | Barlow Condensed | 700 | 18/20 → 20/22 | 0.04em |

- Self-host via `@fontsource`, latin subset: Barlow Condensed 600/700 + Inter variable (wght 400–600) → ≈ 75 KB woff2.
- Preload only the two files used above the fold.
- Indic: Noto Sans Devanagari/Kannada/Tamil loaded **only** when that UI language is chosen (dynamic `import()` of the @fontsource CSS).
- Metric-matched fallbacks (`size-adjust`, `ascent-override`) prevent layout shift while fonts load.
- Minimum text size 14 px; prompt words 20 px+.

---

## 4. Shape, depth, spacing

| Token | Value | Use |
|---|---|---|
| `radius-card` | 28px | Main cards |
| `radius-tile` | 20px | Stat/status tiles, inner panels, prompt media |
| `radius-icon` | 18px | Icon tiles |
| `radius-plate` | 8px | Bhasha Plate |
| pills | `rounded-full` | Buttons, chips, nav pill |
| `shadow-card` | `0 1px 2px rgb(26 21 35 / .04), 0 8px 24px rgb(26 21 35 / .06)` | Cards |
| `shadow-float` | `0 12px 32px rgb(90 59 231 / .28)` | Play pill, primary CTA |
| `shadow-night` | `0 16px 40px rgb(27 22 34 / .35)` | Night cards |

- One depth cue per element (shadow **or** border **or** tinted fill).
- Gutters: 20 (phone) → 24 (sm) → 32 (md) → 40 (lg) → 48 (xl) px. Card padding 20 → 24 → 28 px. Section gaps 32 → 40 px.
- Hit targets ≥ 48 px on touch layouts; ≥ 36 px on desktop.

---

## 5. Iconography

- `lucide-react`, stroke 1.75, imported individually.
- Map: Today `House` · Map `Map` · Play = custom pinch glyph · Wallet `WalletMinimal` · Pals `Users` · Settings `Settings` · Flame `Flame` · Freeze `Snowflake` · Voice `Mic` · Burnt `FlameKindling` · Sound `AudioLines` · Vibe `Palette` · Daily `CalendarCheck` · Payout `ArrowUpRight` · Lock `Lock` · Check `CircleCheck` · Double check `CheckCheck` · Missing `CircleDashed` · Restore `RotateCcw`.
- **No `Sparkles` icon anywhere** (anti-slop rule, UX_STATES.md §2).
- Logo: white rounded tile with a violet two-finger pinch mark (inline SVG).

---

## 6. Imagery

- Onboarding: 3 real Indian photos (college canteen, monsoon street, bus window at dusk), `srcset` 480/720/1080 WebP, LQIP 16 px base64.
- Scrim: `bg-gradient-to-b from-transparent via-night/40 to-night`.
- Prompt images: square, 320/480/720 variants, ≤ 18 KB at 480.
- No stock 3D blobs, no generic illustrations.

---

## 7. Signature components (specs in COMPONENTS.md)

1. **Bhasha Plate** — the number-plate chip reborn with a language strip.
2. **Night Card** — plum-black hero with a giant coral (or marigold/green) numeral.
3. **Daily Card** — the one gradient in the app (`brand-400 → brand`), big translucent circle.
4. **Glass Card** — only over photos.
5. Stat Tile, Status Tile, Icon Row, Segmented Control, Filter Chips, Day Timeline, Bottom Nav / Nav Rail / Sidebar, Sheet / Dialog, Stepper, Confirm Bar.
6. **Flip Card** + **PINCH Stamp** — the loud moment.

---

## 8. Voice & microcopy

Short, kind, concrete. Grade-6 English. One idea per line. See UX_STATES.md §1 for "say less".

| Do | Don't |
|---|---|
| "Same thought! You both said *chai*." | "A semantic match was detected." |
| "Nothing is paid until it's checked." | "Payouts are subject to verification." |
| "Saved. We'll send it when you're online." | "Network error. Sync pending." |
| "Your flame is waiting 🔥" | "You're about to LOSE your streak!!" |
| "₹3.40 added" | "Earnings successfully credited" |

Digits for numbers. ₹ before the number, two decimals under ₹100. Never shame a miss.

---

## 9. The single theme file

`src/styles/theme.css` — imported once in `main.tsx`. Tailwind v4 is configured **in CSS** (`@theme`), so there is no `tailwind.config.js`; this file is the config. Every utility (`bg-brand`, `text-ink-muted`, `rounded-card`, `font-display`, `shadow-float`, `md:`…) is generated from it.

```css
/* src/styles/theme.css — THE single source of design truth */
@import "tailwindcss";

/* Self-hosted fonts (latin subsets) */
@import "@fontsource/barlow-condensed/latin-600.css";
@import "@fontsource/barlow-condensed/latin-700.css";
@import "@fontsource-variable/inter/wght.css";

@theme {
  /* ---------- Breakpoints (RESPONSIVE.md) ---------- */
  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
  --breakpoint-2xl: 96rem;

  /* ---------- Colours: Chai & Marigold ---------- */
  --color-canvas: #F7F4EF;
  --color-surface: #FFFFFF;
  --color-surface-2: #F0EBE3;
  --color-line: #E8E1D6;

  --color-ink: #1A1523;
  --color-ink-2: #3D3547;
  --color-ink-muted: #6B6173;
  --color-ink-faint: #9C92A0;

  --color-brand: #5A3BE7;
  --color-brand-600: #4529C9;
  --color-brand-400: #6E50F2;
  --color-brand-soft: #EEE9FF;
  --color-brand-ink: #33219A;

  --color-night: #1B1622;
  --color-night-2: #272030;
  --color-night-glass: rgb(27 22 34 / 0.62);

  --color-pinch: #FF7A6B;
  --color-pinch-soft: #FFE9E4;
  --color-pinch-ink: #B8382A;

  --color-marigold: #FFB020;
  --color-marigold-soft: #FFF3D6;
  --color-marigold-ink: #9A5800;

  --color-success: #177245;
  --color-success-soft: #E5F5EC;
  --color-success-bright: #5BE49B;
  --color-danger: #C0322B;
  --color-danger-soft: #FDEBE9;

  --color-lang-en: #1F4FBF;
  --color-lang-hi: #E8710A;
  --color-lang-kn: #C9A400;
  --color-lang-ta: #B3261E;
  --color-lang-te: #0B8043;
  --color-lang-mr: #7B1FA2;

  /* ---------- Type ---------- */
  --font-display: "Barlow Condensed", "Barlow Condensed Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter Variable", "Inter Fallback", ui-sans-serif, system-ui, sans-serif;

  --text-hero: 3.25rem;      --text-hero--line-height: 3.375rem;
  --text-title: 2.5rem;      --text-title--line-height: 2.75rem;
  --text-section: 1.75rem;   --text-section--line-height: 2rem;
  --text-numeral: 6rem;      --text-numeral--line-height: 5.5rem;

  /* ---------- Shape & depth ---------- */
  --radius-card: 28px;
  --radius-tile: 20px;
  --radius-icon: 18px;
  --radius-plate: 8px;

  --shadow-card: 0 1px 2px rgb(26 21 35 / 0.04), 0 8px 24px rgb(26 21 35 / 0.06);
  --shadow-float: 0 12px 32px rgb(90 59 231 / 0.28);
  --shadow-night: 0 16px 40px rgb(27 22 34 / 0.35);

  /* ---------- Motion ---------- */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --animate-shimmer: shimmer 1.4s linear infinite;
  @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
}

/* Height variants (RESPONSIVE.md §1) */
@custom-variant short (@media (max-height: 699px));
@custom-variant tall (@media (min-height: 900px));

/* Metric-matched fallbacks: no layout shift while fonts load */
@font-face { font-family: "Inter Fallback"; src: local("Arial"); size-adjust: 107%; ascent-override: 90%; }
@font-face { font-family: "Barlow Condensed Fallback"; src: local("Arial Narrow"), local("Arial"); size-adjust: 82%; ascent-override: 105%; }

@layer base {
  html { -webkit-tap-highlight-color: transparent; text-size-adjust: 100%; }
  body { @apply bg-canvas font-sans text-ink antialiased; }
  :focus-visible { @apply outline-none ring-4 ring-brand/30; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
}

@utility scrollbar-none { scrollbar-width: none; &::-webkit-scrollbar { display: none; } }
```

> Tune the fallback `size-adjust` values once with a font-metrics tool (e.g. Capsize or `fontaine`) against the real fonts; the numbers above are starting points.

**Rules**
- Components never contain hex values, raw font names, or pixel shadows — only tokens. ESLint rule (`no-restricted-syntax` on `/#[0-9a-f]{3,6}/i` in `className`) blocks arbitrary colours.
- New colour? Add a token here first, with its contrast pair checked.
- JS that needs a token (e.g. `theme-color` meta, canvas share image) reads it with `getComputedStyle(document.documentElement).getPropertyValue("--color-brand")`.
