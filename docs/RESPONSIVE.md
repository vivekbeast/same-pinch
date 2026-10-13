# RESPONSIVE.md — one product, three experiences

Same Pinch is **not** one mobile layout stretched onto bigger screens. Phone, tablet and desktop each get a layout designed for how that device is held and used. Logic is shared; presentation is not.

---

## 1. Breakpoints (single source: `src/styles/theme.css`)

Tailwind's default scale, named by what we design for:

| Prefix | Min width | Device class | Layout family |
|---|---|---|---|
| *(base)* | 0 | Small phones (360–639) | **Phone** |
| `sm:` | 640 px | Large phones, phone landscape | **Phone** (roomier) |
| `md:` | 768 px | Tablet portrait | **Tablet** |
| `lg:` | 1024 px | Tablet landscape, small laptops | **Tablet** (wide) |
| `xl:` | 1280 px | Laptops & desktops (incl. 1366×768) | **Desktop** |
| `2xl:` | 1536 px | Large desktops | **Desktop** (wide, capped) |

```css
/* src/styles/theme.css (excerpt) */
@theme {
  --breakpoint-sm: 40rem;   /* 640 */
  --breakpoint-md: 48rem;   /* 768 */
  --breakpoint-lg: 64rem;   /* 1024 */
  --breakpoint-xl: 80rem;   /* 1280 */
  --breakpoint-2xl: 96rem;  /* 1536 */
}
/* Height-aware variants for short screens (phone landscape, small laptops) */
@custom-variant short (@media (max-height: 699px));
@custom-variant tall  (@media (min-height: 900px));
```

`src/lib/breakpoints.ts` mirrors these numbers for JS. A unit test parses `theme.css` and fails if they drift, so the CSS file stays the single source of truth.

---

## 2. The rules

### R1 — Flex first, grid when it's truly 2-D
- Default to `flex` / `flex-col` / `flex-wrap` with `gap-*` for rows, stacks, nav, cards, lists, toolbars.
- Use `grid` only for genuinely two-dimensional layouts: stat-tile rows that must align, the badges grid, the desktop page frame (sidebar · main · panel), the day timeline columns.
- Never use margins to space siblings; use `gap`.

### R2 — Every width and height is declared at every breakpoint
For **layout containers and components** (cards, panels, media, nav, sheets, inputs, buttons), every sizing utility — `w-`, `h-`, `min-h-`, `max-w-`, `size-`, `basis-`, `p-`, `gap-`, `text-` — declares **base, `sm:`, `md:`, `lg:`, `xl:`**, even when a value repeats. Intent stays explicit for every screen and nobody has to guess the cascade.

```tsx
// ✅ Prompt media
<div className="w-full sm:w-full md:w-[56%] lg:w-[58%] xl:w-[520px]
                h-64 sm:h-72 md:h-[420px] lg:h-[460px] xl:h-[520px] short:h-48
                rounded-tile overflow-hidden" />

// ✅ Primary button
<Button className="h-14 sm:h-14 md:h-12 lg:h-12 xl:h-11
                   w-full sm:w-full md:w-auto lg:w-auto xl:w-auto
                   px-6 sm:px-6 md:px-8 lg:px-8 xl:px-7
                   text-[17px] sm:text-[17px] md:text-base lg:text-base xl:text-[15px]" />
```

Exceptions (base value only): icons inside components, borders, dividers, decorative dots.

To keep long class strings readable, group them per breakpoint with the `prettier-plugin-tailwindcss` sort order, and pull repeated sets into `cva` variants (`size: "responsive"`).

### R3 — Use dynamic viewport units
- Full-height screens: `min-h-dvh` (not `h-screen` — mobile address bars break `100vh`).
- Bottom-anchored inputs on phone: keep above the keyboard with `visualViewport` (see Play).
- Respect safe areas: `pb-[env(safe-area-inset-bottom)]`, `pt-[env(safe-area-inset-top)]`; viewport meta has `viewport-fit=cover`.

### R4 — Hover is a bonus, never a requirement
Tailwind v4 applies `hover:` only on devices that can hover. Every hover affordance also has a visible default state or a tap equivalent. Tooltips never hold required information.

### R5 — Input-mode aware
- Phone/tablet: thumb zones, 48 px targets, bottom actions, swipe allowed (always with a button alternative).
- Desktop: keyboard shortcuts, visible focus, denser layouts, actions near content, hover previews.

### R6 — Cap reading width
Text blocks never exceed `max-w-[60ch]`. Desktop pages cap at `max-w-[1440px]` and centre.

### R7 — Images per breakpoint
`<img srcset sizes>` with 320 / 480 / 720 / 1080 WebP variants, `width`/`height` set, `aspect-*` on the container. Desktop never gets a phone-sized blurry image; phone never downloads the desktop one.

---

## 3. Isolation: how layouts are separated

**Shared:** data hooks (`useToday()`, `usePlaySession()`), state machine, API calls, copy, tokens, primitives.
**Separate:** the layout component per device family.

```
features/today/
  hooks/useToday.ts
  layouts/TodayPhone.tsx      // base–sm
  layouts/TodayTablet.tsx     // md–lg
  layouts/TodayDesktop.tsx    // xl+
  pages/Today.tsx             // picks one
```

```tsx
// src/lib/use-breakpoint.ts
import { useSyncExternalStore } from "react";
import { BP } from "./breakpoints";            // { md: 768, xl: 1280 }
export type Family = "phone" | "tablet" | "desktop";
const qTablet = `(min-width: ${BP.md}px)`;
const qDesktop = `(min-width: ${BP.xl}px)`;
function read(): Family {
  if (matchMedia(qDesktop).matches) return "desktop";
  if (matchMedia(qTablet).matches) return "tablet";
  return "phone";
}
function subscribe(cb: () => void) {
  const a = matchMedia(qTablet), b = matchMedia(qDesktop);
  a.addEventListener("change", cb); b.addEventListener("change", cb);
  return () => { a.removeEventListener("change", cb); b.removeEventListener("change", cb); };
}
export const useFamily = () => useSyncExternalStore(subscribe, read, () => "phone");
```

```tsx
// pages/Today.tsx
const TodayTablet = lazy(() => import("../layouts/TodayTablet"));
const TodayDesktop = lazy(() => import("../layouts/TodayDesktop"));
export default function Today() {
  const family = useFamily();
  const data = useToday();
  if (family === "phone") return <TodayPhone {...data} />;          // in the main chunk
  return (
    <Suspense fallback={<TodaySkeleton family={family} />}>
      {family === "tablet" ? <TodayTablet {...data} /> : <TodayDesktop {...data} />}
    </Suspense>
  );
}
```

- **Phone layouts ship in the main bundle; tablet/desktop layouts are lazy chunks.** Phones never download desktop UI.
- Small differences inside a component (padding, size, show/hide a label) use Tailwind prefixes. Different *structure or behaviour* uses separate layouts. Rule of thumb: if you'd need more than 3 `hidden md:block` toggles, split the layout.
- Never render two layouts and hide one with CSS (double DOM, double data).

---

## 4. Per-screen layouts

### App shell

| | Phone (base–sm) | Tablet (md–lg) | Desktop (xl+) |
|---|---|---|---|
| Navigation | Bottom nav, 5 tabs, centre **Play** pill | Left **NavRail** 88 px: icon + label, Play as a big pill at the top | Left **Sidebar** 264 px: logo, nav with labels, mini status (🔥 7 · ₹62.40), Play button |
| Content | 1 column, 20 px gutter | 1–2 columns, 32 px gutter | Main column + right **Context Panel** 360 px |
| Sheets | Bottom sheet (vaul), drag to close | Centred dialog, 560 px | Centred dialog 560 px or right side panel |
| Toasts | Bottom-centre above nav | Bottom-centre | Bottom-right |
| Header actions | Round icon buttons top-right | Same | In sidebar footer (settings), wallet in context panel |

```tsx
<div className="flex min-h-dvh bg-canvas">
  <Sidebar className="hidden sm:hidden md:hidden lg:hidden xl:flex w-0 sm:w-0 md:w-0 lg:w-0 xl:w-[264px]" />
  <NavRail className="hidden sm:hidden md:flex lg:flex xl:hidden w-0 sm:w-0 md:w-[88px] lg:w-[88px] xl:w-0" />
  <main className="flex-1 min-w-0 px-5 sm:px-6 md:px-8 lg:px-10 xl:px-12
                   pb-28 sm:pb-28 md:pb-10 lg:pb-10 xl:pb-12">…</main>
  <ContextPanel className="hidden xl:flex w-0 xl:w-[360px]" />   {/* lazy */}
  <BottomNav className="flex sm:flex md:hidden lg:hidden xl:hidden" />
</div>
```

### Onboarding
- **Phone:** full-bleed photo slides, glass card, hero text, white pill CTA (reference style).
- **Tablet:** photo fills, content sits in a bottom-left panel `max-w-lg`, dots + CTA inline.
- **Desktop:** split 50/50 — left: photo with the glass card; right: canvas panel with headline, sub, dots, CTA, "restore" link; ←/→ keys change slides.

### Today
- **Phone:** stack — Daily card → Flame card → Today so far → Level → New on map (horizontal scroll).
- **Tablet:** two columns (`flex flex-wrap`, each `basis-[calc(50%-12px)]`): left Flame + Daily, right Today + Level; map row full width.
- **Desktop:** Flame card wide at top with stats inline; below, Daily + Level side by side; context panel shows leaderboard top 5 and wallet summary. No horizontal scrollers on desktop — show a grid of 4 region cards.

### Play
- **Phone:** vertical — top bar · prompt media · burnt chips · word plates · input pinned above keyboard · Drop. Reveal: partner card slides up over the bottom half.
- **Tablet:** prompt media left (56%), right column: prompt line, plates, input, Drop. Reveal: partner column appears beside yours in the right column.
- **Desktop:** centre stage — prompt media top centre, below it **two cards side by side: You | Partner** (partner sealed until reveal). Keyboard-first: type + Enter adds a word, Backspace on empty removes last, Ctrl/⌘+Enter drops, Space/→ next. A slim shortcut bar shows keys. Right panel: pack progress list (10 dots with results), live ₹ and XP.

Keyboard on phone: listen to `visualViewport.resize` and set a CSS var `--kb` used as `bottom: var(--kb)` for the input bar, so it's never hidden.

### Results
- **Phone:** dark summary card, list of match cards, sticky Collect bar.
- **Tablet:** summary card left (sticky), match cards right.
- **Desktop:** summary + Collect in the context panel (sticky); match cards in a 3-column flex-wrap grid.

### Wallet
- **Phone:** segmented Earnings | Payouts, stat tiles row, timeline.
- **Tablet:** stat tiles row; segmented stays.
- **Desktop:** no segmented control — Earnings timeline and Payouts list side by side; "Send to UPI" opens a dialog.

### Map
- **Phone:** map card then filter chips and region list.
- **Tablet/Desktop:** map left (large, hover highlights a region and its list row), list right in its own scroll area.

### Daily
- **Phone:** one prompt per screen.
- **Tablet/Desktop:** all 5 prompts visible as a row of cards; the active one enlarges; results grid on the side.

### Settings
- **Phone:** single list of grouped cards.
- **Tablet/Desktop:** left: section list (Play, Reminders, Keep it safe, Your answers); right: the selected section. Fair Play Promise card spans the top.

---

## 5. Testing responsiveness (free tools)

| Tool | What it's good for | Cost |
|---|---|---|
| **Chrome DevTools Device Mode** (`Ctrl/⌘+Shift+M`) | Exact viewports, throttling, touch emulation, `short:` heights | Free |
| **Responsively App** (responsively.app) | Open-source desktop browser that shows many devices side by side with synced scroll and clicks — fastest way to catch breakpoint bugs | Free |
| **Am I Responsive** (ui.dev/amiresponsive) | Quick 4-device screenshot of a deployed URL, nice for the README | Free |
| **Responsive Viewer** (Chrome extension) | Multi-device view inside your browser, works on localhost | Free |
| **PageSpeed Insights** (pagespeed.web.dev) | Lighthouse on real Google infra, **mobile and desktop** tabs, plus real-user data when available | Free |
| **WebPageTest** (webpagetest.org) | Filmstrips and traces on real devices/locations | Free tier |
| **LambdaTest LT Browser** | Device previews + real-device cloud | Free tier (limited) |
| **Firefox Responsive Design Mode** | Second engine check | Free |
| **Your own low-end Android** via `chrome://inspect` | The truth | Free |

### Viewport checklist (test every screen at each)

| Family | Sizes |
|---|---|
| Phone | 360×740, 375×667 (short), 393×852, 412×915, 740×360 (landscape → `short:`) |
| Tablet | 768×1024, 820×1180, 1024×768, 1180×820 |
| Desktop | 1280×720, 1366×768, 1440×900, 1920×1080 |

Pass criteria: no horizontal scroll, no clipped text at 200% zoom, no element smaller than 44 px tap target on touch, nav pattern correct for the family, images sharp, layout switches cleanly when resizing across 767↔768 and 1279↔1280.

Automate: Playwright projects for `Pixel 7`, `iPad Mini`, `Desktop 1366` run the critical journeys and take screenshots for visual review (`toHaveScreenshot` with a small threshold).
