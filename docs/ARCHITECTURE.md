# ARCHITECTURE.md — the whole system

## 1. Overview

```
┌───────────────────────── Browser (PWA) ──────────────────────────┐
│ React 19 UI  (Phone / Tablet / Desktop layouts — RESPONSIVE.md)   │
│   ├─ Zustand: play-session state machine                          │
│   ├─ TanStack Query: server state, offline-first                  │
│   ├─ Dexie (IndexedDB): packs · answer queue · caches             │
│   └─ Service Worker (Workbox): app shell · prompt assets · offline│
└───────────────┬───────────────────────────────────────────────────┘
                │ https://samepinch.vercel.app   (one origin)
     ┌──────────┴──────────┐
     │ Vercel CDN          │  /*      → index.html, JS/CSS, fonts, /prompts/*.webp, /sounds
     │ (web project)       │  /api/*  → rewrite to API project (proxy)
     └──────────┬──────────┘
                ▼
     Express 5 API (Vercel Function, Fluid compute) — BACKEND.md
                ▼
     Neon Postgres (free) — DATA_MODEL.md
```

Detailed backend design: **BACKEND.md**. Endpoints: **API.md**. Free services: **FREE_STACK.md**.

## 2. Repository layout (independent packages)

```
same-pinch/
  frontend/   React PWA          — own package.json, installs/builds/deploys alone
  backend/    Express API + DB   — own package.json, own docker-compose.yml
  shared/     zod schemas, types, normalize(), detectLang(), constants — owns the only zod copy
```
Both apps import shared code through the `@shared` alias (tsconfig `paths` + Vite alias + tsup bundling), so the client preview and the server agree on normalisation and payload shapes without a workspace.

## 3. Web app folder layout

```
frontend/src/
  main.tsx                 imports styles/theme.css, mounts <App/>
  app/                     router.tsx, providers.tsx, AppShell.tsx, ErrorBoundary.tsx
  styles/theme.css         THE single theme file (DESIGN_SYSTEM.md §9)
  lib/                     api.ts, db.ts (Dexie), cn.ts, motion.ts, haptics.ts, sound.ts,
                           i18n.ts, format.ts, breakpoints.ts, use-breakpoint.ts, use-delayed.ts, device.ts
  components/
    ui/                    button, switch, tabs, dialog, drawer, toggle-group, progress, spinner, skeleton (shadcn → rewritten)
    shell/                 BottomNav.tsx (phone), NavRail.tsx (tablet), Sidebar.tsx (desktop), ContextPanel.tsx (desktop, lazy)
    bhasha-plate.tsx  night-card.tsx  daily-card.tsx  glass-card.tsx  stat-tile.tsx  status-tile.tsx
    icon-tile.tsx  list-row.tsx  section-header.tsx  segmented.tsx  filter-chips.tsx  day-timeline.tsx
    stepper.tsx  responsive-sheet.tsx  page-header.tsx  offline-banner.tsx  empty-state.tsx
  features/
    onboarding/  today/  play/  results/  daily/  map/  wallet/  pals/  profile/  settings/  system/ (NotFound, Offline, Error)
      └─ each: hooks/  layouts/{X}Phone.tsx {X}Tablet.tsx {X}Desktop.tsx  components/  pages/  route.tsx
  locales/                 en.json hi.json kn.json ta.json
public/
  prompts/  onboarding/  sounds/  icons/  offline.html  robots.txt  manifest.webmanifest (generated)
```

## 4. Offline design

| Data | Where | Strategy |
|---|---|---|
| App shell, fonts, onboarding images, sounds, `offline.html` | SW precache | Versioned per build |
| Packs (prompt metadata) | Dexie `packs` | Keep **2 unplayed packs** stored; refill when online and idle |
| Prompt images/audio | SW runtime cache (`CacheFirst`, 30 days, 300 entries) | Prefetched when a pack is stored |
| Answers to send | Dexie `queue` (with `attemptId`) | Flushed on `online`, app focus, and Background Sync where supported |
| Me, ledger, map | Dexie cache + TanStack Query | Show cached instantly, refresh in background |

**Offline reveal:** partner answers never reach the client before submission, so offline rounds show a sealed card ("Saved — result when you're online"). When the queue flushes, results arrive and a toast says "3 results are in — 2 pinches!". Opening Results replays the stamps.

**Streak offline:** a pack counts for the day it was *played* (`playedAt`), accepted if ≤ 48 h old (server validates).

**Conflicts:** the server owns ₹, XP, flame. The client shows optimistic values with a small syncing dot until confirmed.

## 5. Play session state machine (Zustand)

```
idle ─start→ prompting ─drop→ checking ─result→ revealing ─next→ prompting … → summary
                 │               │ offline/err
                 └─timeout→drop  └→ sealed ─next→ prompting
```

```ts
type Phase = "idle" | "prompting" | "checking" | "sealed" | "revealing" | "summary";
interface PlayState {
  pack: Pack | null; index: number; phase: Phase; words: Word[]; results: RoundResult[];
  start(pack: Pack): void; addWord(w: Word): void; removeWord(i: number): void;
  drop(): Promise<void>; next(): void; reset(): void;
}
```

`drop()`: write the answer to the Dexie queue with a fresh `attemptId` → if online `POST /rounds` → on success mark done and reveal; on network failure → `sealed`.

## 6. Routing & code splitting

```tsx
const router = createBrowserRouter([
  { path: "/welcome", lazy: () => import("@/features/onboarding/route") },
  { element: <AppShell />, errorElement: <RouteError />, children: [
      { index: true, lazy: () => import("@/features/today/route") },
      { path: "map", lazy: () => import("@/features/map/route") },
      { path: "wallet", lazy: () => import("@/features/wallet/route") },
      { path: "pals", lazy: () => import("@/features/pals/route") },
      { path: "me", lazy: () => import("@/features/profile/route") },
      { path: "settings", lazy: () => import("@/features/settings/route") },
  ]},
  { path: "/play/:packId", lazy: () => import("@/features/play/route") },
  { path: "/play/:packId/done", lazy: () => import("@/features/results/route") },
  { path: "/daily", lazy: () => import("@/features/daily/route") },
  { path: "*", lazy: () => import("@/features/system/NotFound") },
]);
```
- Each route's `HydrateFallback`/Suspense fallback is that route's skeleton (UX_STATES.md §3).
- Tablet/desktop layouts are separate lazy chunks; phones never download them.
- Prefetch the Play chunk and next pack on idle (`requestIdleCallback`) from Today.

## 7. Static app shell in `index.html` (for Lighthouse ≥ 95)

`index.html` contains a tiny inline-styled shell — logo, the word "Today", and grey card placeholders — painted before any JS runs. React replaces it on mount. This gives a fast FCP/LCP on slow phones and a non-blank page if JS fails, plus the `<noscript>` message.

## 8. Auth flow (client)

1. App boot → `GET /api/v1/me`.
2. `401` → if onboarding done locally, call `POST /auth/anon` silently; otherwise route to `/welcome`.
3. Cookie is HttpOnly — JS never sees the token. `X-SP-Device` = random UUID in `localStorage`.

## 9. Analytics

Own `events` table via `POST /events` — no third-party trackers. Events: `app_open`, `pack_start`, `round_drop`, `pack_collect`, `daily_done`, `share`, `install_accept`, `payout_request`, `vitals`.

## 10. Error handling

- Route `errorElement` + top-level ErrorBoundary (UX_STATES.md §5).
- `ChunkLoadError` → reload once automatically, then "New version — Refresh".
- API codes → short copy. Sentry (browser) loads lazily after first interaction; no answers or UPI IDs in events.
