# Same Pinch 🤏

> **Think alike. Any language. Get paid for every match.**
> The childhood game, rebuilt so strangers across India discover they think alike — while earning for every verified match.

Same Pinch is a responsive, offline-capable web app (PWA). Two people see the same image, sound or question and each drop up to three words. If any word matches — even across languages ("naayi" = "kutta" = "dog") — both shout **SAME PINCH!** and earn.

Every verified pinch is a human-agreed label (the ESP Game principle, 2003): real value for an AI-data business, real income for the player.

**Stack:** React 19 + Vite + Tailwind v4 (one theme file) · Node.js + Express 5 · PostgreSQL (Neon) · hosted free on Vercel. The brief didn't mandate any technology; reasons are in `docs/TECH_STACK.md`.

---

## Doc index

| # | File | What's inside |
|---|---|---|
| 0 | [`AGENTS.md`](./AGENTS.md) | Rules for contributors and AI coding agents. Read first. |
| 1 | [`docs/PRODUCT.md`](./docs/PRODUCT.md) | PRD: users, constraints, research, scope, metrics |
| 2 | [`docs/GAME_DESIGN.md`](./docs/GAME_DESIGN.md) | Every mechanic, formula, level, badge, streak rule, legal rule |
| 3 | [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) | Reference analysis, researched palette, type, **the single `theme.css`** |
| 4 | [`docs/RESPONSIVE.md`](./docs/RESPONSIVE.md) | Breakpoint rules, separate phone/tablet/desktop layouts, free testing tools |
| 5 | [`docs/UX_STATES.md`](./docs/UX_STATES.md) | Say-less copy, anti-"AI slop" rules, loading/skeletons/spinners, fallbacks, 404 |
| 6 | [`docs/SCREENS.md`](./docs/SCREENS.md) | Every screen end to end (phone wireframes) |
| 7 | [`docs/COMPONENTS.md`](./docs/COMPONENTS.md) | Component inventory + Tailwind rebuilds of shadcn/Radix |
| 8 | [`docs/MOTION.md`](./docs/MOTION.md) | Animation + haptics spec (Motion) |
| 9 | [`docs/TECH_STACK.md`](./docs/TECH_STACK.md) | Library choices and rejections, bundle budget |
| 10 | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Whole system, web app structure, offline, routing |
| 11 | [`docs/BACKEND.md`](./docs/BACKEND.md) | Express architecture: pipeline, auth, scoring, jobs, rate limits |
| 12 | [`docs/API.md`](./docs/API.md) | REST endpoint contracts |
| 13 | [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) | PostgreSQL schema (Drizzle), access rules, seed |
| 14 | [`docs/FREE_STACK.md`](./docs/FREE_STACK.md) | ₹0 services, limits, one-hour setup |
| 15 | [`docs/CONTENT_I18N.md`](./docs/CONTENT_I18N.md) | Prompts, lexicon, languages, copy |
| 16 | [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) | Lighthouse ≥ 95 everywhere: budgets, techniques, CI |
| 17 | [`docs/ACCESSIBILITY.md`](./docs/ACCESSIBILITY.md) | A11y checklist |
| 18 | [`docs/SECURITY.md`](./docs/SECURITY.md) | Threat model, anti-cheat, headers, privacy |
| 19 | [`docs/TESTING.md`](./docs/TESTING.md) | Unit, API, e2e, responsive, Lighthouse |
| 20 | [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) | Vercel + Neon setup, CI/CD, go-live checklist |
| 21 | [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Submission email draft |
| 22 | [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Settled conflicts between docs (wins over others) |
| 23 | [`docs/UI_DIRECTION.md`](./docs/UI_DIRECTION.md) | The upgraded creative direction: plates, stamps, Plate Map |

---

## Quickstart (local)

Needs Node 22+ and Docker.

```bash
npm run setup                               # installs root, shared/, backend/, frontend/ separately
cp backend/.env.example backend/.env        # then generate the three secrets (openssl rand -base64 48)
npm run db:up                               # Postgres 16 on localhost:5433
npm run db:migrate --prefix backend && npm run db:seed --prefix backend
npm run dev                                 # api :3000 + web :5173 (web proxies /api)
```

| Command | What |
|---|---|
| `npm run dev` | API + web with hot reload |
| `npm run build` | Build backend (tsup, bundles shared) and frontend (Vite + PWA) |
| `npm run typecheck` / `npm run lint` / `npm test` | Quality gates |
| `npm run size --prefix frontend` | First-paint budget gate (JS ≤ 150 KB, CSS ≤ 18 KB gzip) |
| `npm run fetch:photos --prefix frontend` | Fetch/refresh CC0 prompt photos (credits in `content/CREDITS.md`) |
| `npm run db:up` / `npm run db:down` | Start / stop local Postgres |
| `npm run db:migrate --prefix backend` | Apply SQL migrations (`backend/drizzle/`) |
| `npm run db:seed --prefix backend` | Seed content, partners and the demo account (idempotent) |
| `npm run db:reset --prefix backend` | Wipe the local DB volume, migrate and seed |
| `npm run db:generate --prefix backend` | New migration after editing `schema.ts` |

Demo account: restore code **`SAME7777`**.

Google sign-in (optional): set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in `backend/.env`. In the Google console, the authorized JavaScript origin is `http://localhost:5173` and the redirect URI is `http://localhost:3000/api/auth/google/callback`.

Settled design conflicts: [`docs/DECISIONS.md`](./docs/DECISIONS.md). Deploying for free: `docs/FREE_STACK.md` → `docs/DEPLOYMENT.md`.

---

## The 30-second pitch (for the reviewer)

- **Short task, real reward:** 10 rounds ≈ 2 minutes. ₹ is paid for verified work, never for winning or luck (India's 2025 online gaming law). Earned money never goes down.
- **Hooks that fit:** flame streak + freeze, XP levels, badges, city leaderboard, Think Like India daily challenge, Sync Map of all 36 states and UTs.
- **Built for the users:** offline play against recorded partners, ~150 KB per pack, Hindi/Kannada/Tamil/English, icon-first UI, Lighthouse ≥ 95 on mobile and desktop.
- **Three real layouts:** phone, tablet and desktop each designed for how the device is used.
- **Quality built in:** two strangers agreeing *is* the verification; hidden test prompts tune pay; all scoring happens on the server.
