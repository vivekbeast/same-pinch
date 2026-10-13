# TECH_STACK.md — choices and reasons

Deciding constraints: **cheap Android phones on mobile data**, **Lighthouse ≥ 95 in every category on mobile and desktop**, **₹0 hosting**, **5 days**. The brief doesn't mandate any technology, so these are our choices.

## Frontend

| Layer | Choice | Why |
|---|---|---|
| Build | **Vite** + React + TypeScript (strict) | Fast dev, small output, first-class PWA plugin. SPA with a static shell suits an offline game. |
| UI | **React 19** | Familiar, ecosystem (Radix, Motion). |
| Routing | **React Router** (data router, `lazy` routes) | Route-level code splitting and error elements. |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`), config in **one CSS file** (`theme.css`) | Zero runtime, tokens generate utilities, ~12 KB CSS. |
| Primitives | **shadcn/ui → Radix UI** | Accessible behaviour (focus, keyboard, ARIA) with no imposed look; code lives in our repo and is restyled. |
| Variants | `class-variance-authority`, `clsx`, `tailwind-merge` | Typed variants, safe class merging. |
| Animation | **Motion** (`motion/react`, `LazyMotion` + `m`) | Springs/layout animations with a small initial cost. |
| Sheets / dialogs | **vaul** (phone sheets) + Radix Dialog (tablet/desktop) | Native-feeling drag sheet on phones, centred dialog on larger screens. |
| Toasts | **sonner** | Small, accessible. |
| Icons | **lucide-react** | Matches the reference style; tree-shakable. |
| Server state | **TanStack Query** | Caching, retries, offline-first mutations. |
| Client state | **Zustand** | Game state machine without re-render storms. |
| Local DB | **Dexie** | IndexedDB for packs, queue, caches. |
| PWA | **vite-plugin-pwa** (Workbox) | Precache, runtime cache, offline fallback. |
| Validation | **zod** (shared with API) | One schema for client and server. |
| Fonts | `@fontsource` Barlow Condensed + `@fontsource-variable/inter` (+ Noto Indic on demand) | Self-hosted, subset, no third-party font requests. |

## Backend

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 22 LTS** | Supported by Vercel Functions; modern APIs (fetch, crypto). |
| Framework | **Express 5** | Ubiquitous, async error handling built in, zero-config deploy on Vercel. |
| DB | **PostgreSQL** on **Neon** (free) | Relational data, transactions for money, free tier with pooling. |
| ORM / migrations | **Drizzle ORM** + **drizzle-kit** + `postgres` (postgres.js) driver | Type-safe SQL, tiny runtime, plain SQL migrations committed to git. |
| Auth | Own anonymous sessions (HttpOnly cookie, hashed token) + restore code | No vendor, revocable, free, fast to build (BACKEND.md §4). |
| Security middleware | `helmet`, custom origin guard, Postgres-backed rate limiter | Small and explicit. |
| Logging | `pino` + `pino-http` | Fast JSON logs with redaction. |
| Errors | Sentry Node SDK (free plan) | Exceptions + light tracing. |
| Tests | Vitest + supertest | Same runner as the web app. |

## Tooling

ESLint (typescript-eslint, react-hooks, jsx-a11y, tailwind class checks), Prettier + `prettier-plugin-tailwindcss`, Playwright, Lighthouse CI, size-limit, gitleaks, Dependabot.

## Considered and rejected

Using several UI kits at once is the fastest way to a 600 KB bundle with competing styling systems — incompatible with Lighthouse ≥ 95 on a cheap phone.

| Library | Verdict | Reason |
|---|---|---|
| **Material UI** | ❌ | CSS-in-JS runtime (Emotion), Material look to fight, heavy baseline. |
| **Chakra UI** | ❌ | Runtime styling system that duplicates Tailwind. |
| **Mantine** | ❌ (as UI) | Great library, but its own styling system overlaps Tailwind + Radix. Borrow ideas from `@mantine/hooks` freely. |
| **DaisyUI** | ❌ | Opinionated class names/themes that clash with token-first Tailwind; weaker behaviour primitives than Radix. |
| **Base UI** | ⚖️ | Excellent unstyled alternative to Radix. Pick one — we use Radix because shadcn generators target it. |
| **Kibo UI / 21st.dev / Magic UI / Aceternity** | 📚 Reference | Read for patterns; rebuild in our tokens. Many effects are too heavy for low-end GPUs and read as "AI slop" (UX_STATES.md §2). |
| **Next.js** | ❌ here | SSR/RSC not needed for an offline game shell; heavier client baseline; Express is requested separately as the backend. |
| **NestJS / Fastify** | ❌ | Nest is heavy for 5 days; Fastify is great but Express is the stated preference. |
| **Prisma** | ❌ | Larger runtime and query-engine overhead vs Drizzle on serverless. |
| **Supabase / Firebase as backend** | ❌ (now) | Would replace the Express layer; kept as a fallback DB option only (FREE_STACK.md). |
| **Redis** | ❌ | Postgres handles rate limits and caching at this scale. |
| **i18next** | ❌ | 40-line typed `t()` is enough. |
| **Lottie** | ❌ | Player + JSON weight; Motion + CSS cover our animations. |

## Bundle budget (gzip, initial route)

| Chunk | Budget |
|---|---|
| React + ReactDOM | ~45 KB |
| React Router | ~12 KB |
| Motion (LazyMotion + domAnimation) | ~15 KB |
| Radix primitives used on first screen | ~10 KB |
| TanStack Query | ~13 KB |
| Dexie | ~14 KB |
| Zustand, zod (tree-shaken), utils, icons | ~12 KB |
| App code (Today phone layout) | ~25 KB |
| **Initial total** | **≤ 150 KB** |

Everything else (Play, Results, Map SVG, Daily, Settings, tablet/desktop layouts, Sentry) loads on demand or on idle.
