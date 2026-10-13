# DECISIONS.md — settled conflicts between the docs

When another doc disagrees with this file, this file wins.

| # | Topic | Decision |
|---|---|---|
| D1 | Timer warning colour | **Marigold** at ≤ 5 s (DESIGN_SYSTEM, MOTION, SCREENS). COMPONENTS' `stroke-pinch` is wrong. |
| D2 | App shell layouts | The shell picks one nav per family with `useFamily()`: BottomNav (phone), NavRail (tablet), Sidebar + ContextPanel (desktop). Never render all three and hide two with CSS. NavRail, Sidebar and ContextPanel are lazy chunks. |
| D3 | Responsive sizing rule (R2) | Applies to **layout containers and size variants** (shell, page frames, media, Button/Input sizes). Repeated sets live in `cva` variants. Small leaf components (chips, tiles, plates) declare only the breakpoints where the value changes. |
| D4 | Lighthouse CI data | `vite preview` proxies `/api` to `:3001`. CI starts the API against a migrated and seeded Postgres before Lighthouse runs, so `?demo=1` pages render real data. |
| D5 | Paid vs XP-only packs | Packs are stored on the device ahead of time with `is_paid = false`. Paid status is decided **when the pack is collected**: if the user has paid packs left today (by the day the pack was played), the earnings are credited, otherwise the pack gives XP only. Round responses show the ₹ amount as provisional. |
| D6 | Session cache vs revocation | The session cache lasts 60 s for normal reads. Logout and logout-all clear it on that instance, and money-moving routes (collect, payouts) always check the session in the database. |
| D7 | Handles | Anonymous sign-up generates a unique handle (`adjective_noun_123`) that matches `^[a-z0-9_]{3,20}$`. Users can change it with `PATCH /me`. |
| D8 | Old-browser fallback | Served as an external `public/legacy.js` (`nomodule`), not an inline script, because CSP is `script-src 'self'`. |
| D9 | Burnt words | Recomputed when packs are requested (BACKEND §6); there is no cron job. |
| D10 | Pack partner answers | Packs contain prompt metadata and assets only. Partner answers never leave the server before the player has submitted. |
| D11 | Age | Users must be **18+** (`ageConfirmed`). Content is also kept suitable for 16+ (CONTENT_I18N), which is stricter content, not a lower age. |
| D12 | shadcn | We don't run `shadcn init`. Radix primitives are installed directly, and our `components/ui/*` are hand-written in shadcn's style using our tokens (same result, no generator config). |
| D13 | Tooling versions | TypeScript 6.0.x (typescript-eslint supports < 6.1); ESLint 9 (jsx-a11y doesn't support ESLint 10 yet); `esbuild` overridden to a patched version. |
| D14 | Repo layout | `frontend/`, `backend/` and `shared/` are **independent packages**, not an npm workspace: each has its own package.json, lockfile and node_modules (`npm run setup` at the root installs all three). `shared/` is TS source and owns the single `zod` copy. Both apps import it as `@shared` (and import `z` from it, never from `zod` directly). The frontend resolves it through a Vite alias plus `server.fs.allow`; the backend through tsconfig `paths` (tsx), tsup `noExternal` and a Vitest alias. |
| D15 | Local DB | `backend/docker-compose.yml` runs `postgres:16-alpine` on host port **5433** (`npm run db:up`), so it never clashes with other local Postgres instances. |
