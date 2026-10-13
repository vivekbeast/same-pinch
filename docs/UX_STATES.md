# UX_STATES.md — loading, fallbacks, errors, 404, and "say less"

## 1. Say less, show more

The app should explain itself through flow, not paragraphs.

- **One line per idea, max two lines under any title.** If a screen needs a paragraph, the design is wrong.
- Teach by doing: the first round *is* the tutorial. A ghost hint "Type what you see" sits in the input on round 1 only, then disappears forever.
- Icons + numbers carry meaning (🔥 7, ₹3.40, 6/10). Words confirm, they don't explain.
- No "Welcome to Same Pinch! Here's how it works…" modals. No feature tours. No tooltips on first open.
- Help lives in one place: Settings → "How it works" (5 short cards with pictures).
- Every screen passes the **3-second test**: a new user knows what to tap within 3 seconds.

| Instead of | Use |
|---|---|
| "Enter up to three words that describe what you see in the image" | Input placeholder: "What do you see?" + 3 empty plate slots |
| "You and your partner matched on a semantically equivalent concept" | Stamp: **SAME PINCH!** |
| "Your streak will be lost if you don't play today" | 🔥 7 + "Play today" |
| A paragraph on how pay works | One line: "₹0.50 per match" + a "How pay works" link |

---

## 2. Avoid "AI slop" UI

The tell-tale signs of generic generated interfaces, and what we do instead:

| Slop pattern | Our rule |
|---|---|
| Purple → pink gradients everywhere, glowing blobs | One subtle violet gradient (two close violets), used on **one** card. Everything else is flat. |
| Glassmorphism on every card | Glass only over photos (onboarding). Nowhere else. |
| ✨ sparkle icons, 🚀 emoji headings | No sparkle icon at all. Emoji only inside game moments (🔥 🤏), never in headings or buttons. |
| Centered hero + 3 identical feature cards | Dashboard layout from real product needs; cards differ in shape and weight (night card vs white list vs stat tiles). |
| Generic stock illustrations / 3D blobs | Real Indian photos (onboarding), real prompt images, our own pinch glyph. |
| Inter for everything, same weight | Barlow Condensed display + Inter body, strong size contrast (96 px numeral vs 14 px caption). |
| Gray-on-gray low contrast "minimal" text | All text ≥ 4.5:1; muted text still clearly readable. |
| Vague microcopy ("Unlock your potential") | Concrete words: "₹3.40 added", "Flame safe for today". |
| Shadows + borders + gradients on the same element | One depth cue per element: shadow **or** border **or** fill. |
| Every element animated on load | Motion only for state changes and the pinch moment (MOTION.md). |
| Rounded-xl on everything | Deliberate radius scale: 28 card / 20 tile / 18 icon / 8 plate / full pill. |
| Dashboard "metric cards" with fake sparklines | Only numbers that change a user's next action. |

Review question for every screen: *"Could this screenshot belong to any random app?"* If yes, it needs a Same Pinch element (plate, night card, flame numeral, pinch stamp, real photo).

---

## 3. Loading strategy

| Situation | Pattern | Never |
|---|---|---|
| Route chunk loading | Route-shaped **skeleton** as Suspense fallback | Full-screen spinner |
| Data on a screen (first load) | Skeleton matching final layout; cached data from IndexedDB shown instantly when available | Blank screen |
| Background refresh | Nothing visible, or a 2 px progress line under the header if > 1 s | Replacing content with skeletons |
| Button action (Collect, Send, Save) | Inline spinner **inside** the button + verb-ing label ("Collecting…"), button keeps width | Disabling the whole page |
| Pack download / prefetch | Determinate progress ring with "2 of 10" | Indeterminate spinner for long tasks |
| Image loading | Fixed aspect box with `bg-surface-2`, LQIP blur for photos, fade in on load | Layout shift |
| Very fast loads (< 150 ms) | Show nothing (delay loaders by 150 ms) | Flash of skeleton |
| Loader shown | Keep it ≥ 300 ms to avoid flicker | Blink-in-blink-out |

```tsx
// src/lib/use-delayed.ts — avoid loader flashes
export function useDelayedFlag(active: boolean, delay = 150, minShow = 300) { /* … */ }
```

### Skeleton rules
- Same size, radius and position as real content (use the same layout component with a `loading` prop where possible).
- Colour `bg-surface-2`, text lines 60–80% width, avatars round.
- Shimmer: one gradient sweep, 1.4 s, disabled under reduced motion.
- `aria-busy="true"` on the region and a visually hidden "Loading" label.

### Spinner
One spinner component only: 20 px (in buttons) / 32 px (inline areas), 2 px stroke, `currentColor`, CSS `animate-spin` (no JS), `role="status"` + hidden label.

---

## 4. Fallbacks (everything has a plan B)

| Feature | Fallback |
|---|---|
| JS disabled | `<noscript>` card in `index.html`: logo + "Please turn on JavaScript to play." |
| Old browser (no ES2020) | Static "Update Chrome to play" page via `nomodule` script |
| Route chunk fails (deploy in between) | ErrorBoundary catches `ChunkLoadError` → auto-reload once, then "New version available — Refresh" |
| Network offline | Offline banner; saved packs playable; sealed reveals (ARCHITECTURE.md §4) |
| First visit offline (nothing cached) | SW navigation fallback → `offline.html` (static, 5 KB): "You're offline. Connect once to download your first packs." |
| API 5xx / timeout | Retry with backoff (TanStack Query, 2 retries), then inline error card with "Try again" |
| Image fails | Neutral tile with an icon and "Image didn't load" + Skip round (no penalty) |
| Audio fails / autoplay blocked | Big play button; if still failing, round is replaced by an image prompt |
| Fonts slow | `font-display: swap` + metric-matched fallback (`size-adjust`) → no layout shift |
| Indic font missing | System Noto fallback in the font stack |
| `navigator.vibrate` missing (iOS) | Visual squeeze only |
| Web Share API missing | Copy to clipboard + "Copied" toast |
| Clipboard blocked | Show the share text in a selectable box |
| Speech recognition missing | Hide the mic button entirely (don't show a disabled one) |
| `backdrop-filter` unsupported / data saver | Solid `bg-night/85` |
| Storage full / IndexedDB blocked (private mode) | Play online-only; one-time notice "Offline play is off in private mode" |
| Reduced motion | Static alternatives (MOTION.md) |
| Notifications denied | In-app reminder on next open instead; no nagging |

---

## 5. Error pages & screens

### 404 — "That's a miss"
- Layout: canvas background, centred Night card.
- Big numeral `404` in coral with the pinch glyph replacing the `0`.
- Three Bhasha Plates under it: `EN miss` `HI नहीं` `KN ಇಲ್ಲ` (a tiny joke in the app's own language).
- One line: "This page doesn't exist."
- Buttons: **Back to Today** (primary), "Play a round" (ghost).
- Router: `{ path: "*", lazy: () => import("@/features/system/NotFound") }`. Host config serves `index.html` for unknown paths so the SPA renders this page; the page sets `<meta name="robots" content="noindex">`.
- Phone: card fills width; tablet/desktop: card 480 px centred with the plates in a row.

### Error boundary (500-style)
- Night card, icon, "Something broke on our side." + **Reload** + "Go to Today".
- Shows a short error ID (Sentry event ID) users can quote. No stack traces.

### Offline page (`public/offline.html`)
- Inline CSS only, logo SVG inline, works with zero network.

### Maintenance / paid play paused
- Banner on Today: "Paid play is paused for a short while. XP still counts." (driven by `/api/config`).

---

## 6. Empty states

| Screen | Empty state |
|---|---|
| Today (new user) | Flame card shows "0 · Start your flame" and a single CTA |
| Wallet | Icon tile + "Your first match adds money here." + Play |
| Map | Faded map + "Pinch to light up India." |
| Leaderboard (new week) | "Week just started — be first." |
| Badges | Locked badges shown greyed with one-line "how to get" |
| Results with 0 pinches | "No match this time — that happens!" + Play again |

Every empty state = icon tile + one line + one action.

---

## 7. Feedback timing

| Interaction | Feedback within |
|---|---|
| Tap | 0–50 ms (press scale, haptic tap) |
| Word added | instant |
| Drop → reveal | ≤ 300 ms to start the drumroll (server call runs during it; if > 1.2 s, show "Checking…" under the cards) |
| Collect | Coins start immediately (optimistic), confirm on response; on failure, coins return and an inline retry appears |
