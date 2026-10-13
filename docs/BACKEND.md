# BACKEND.md — Node + Express architecture

The brief names no required stack ("build a small, responsive web app"), so we choose **Node.js + Express 5 + PostgreSQL**. Express is boring, well known by every reviewer, and deploys for free with zero config on Vercel.

## 1. System diagram

```
            Phone / Tablet / Desktop browser (PWA)
                         │  same origin: https://samepinch.vercel.app
        ┌────────────────┴──────────────────┐
        │  /*        → Vercel CDN (React SPA, prompt images, audio)
        │  /api/*    → rewrite (proxy) ─────────────────────────┐
        └────────────────────────────────────┘                  │
                                                                ▼
                                     Express 5 app (Vercel Function, Fluid compute)
                                     region: next to the database
                                       ├─ middleware: requestId · logger · security
                                       │              json(8kb) · session · origin/CSRF
                                       │              rate-limit · zod validate · errors
                                       ├─ routes  → controllers → services
                                       └─ Drizzle ORM ──► Neon Postgres (free)
```

- **Same origin.** The web app proxies `/api/*` to the API project, so cookies are first-party, there's no CORS, and the browser makes one TLS connection.
- **Stateless app servers.** All state lives in Postgres. Any instance can serve any request.
- **No background workers in the MVP.** "Jobs" (burning words, leaderboard, demo payouts, daily set) run **lazily on read** or via a protected endpoint called by a scheduled GitHub Action. Zero extra services.

## 2. Repository layout (three independent packages)

```
same-pinch/
  frontend/                 Vite + React PWA (see ARCHITECTURE.md) — own package.json
  backend/                  own package.json, own docker-compose.yml
      src/
        index.ts            export default app  (Vercel entry; also app.listen() locally)
        app.ts              builds the Express app (middleware + routes)
        config.ts           env parsing with zod (fails fast)
        db/
          client.ts         postgres.js + drizzle
          schema.ts         Drizzle tables (DATA_MODEL.md)
          migrations/       drizzle-kit output (SQL, committed)
          seed/             prompts, lexicon, seeded partners, demo users
        middleware/
          request-id.ts  logger.ts  security.ts  session.ts  origin-guard.ts
          rate-limit.ts  validate.ts  error-handler.ts  not-found.ts
        routes/
          auth.routes.ts  me.routes.ts  packs.routes.ts  rounds.routes.ts
          daily.routes.ts  wallet.routes.ts  map.routes.ts  leaderboard.routes.ts
          config.routes.ts  events.routes.ts  jobs.routes.ts  health.routes.ts
        services/
          auth.service.ts      sessions, restore codes
          pack.service.ts      pack building
          scoring.service.ts   normalise → concepts → match tiers
          partner.service.ts   recorded partner selection
          economy.service.ts   pay, XP, levels, caps, ledger
          flame.service.ts     streak + freeze logic (pure functions)
          badges.service.ts    rule evaluation
          burn.service.ts      burnt words (lazy recompute)
          daily.service.ts     deterministic daily set + grading
          leaderboard.service.ts
          payout.service.ts    demo payouts
          antiabuse.service.ts flags & heuristics
        lib/
          errors.ts  ids.ts  time.ts  crypto.ts  cache.ts (tiny in-memory TTL cache)
      test/                 vitest + supertest
      vercel.json
  packages/
    shared/                 zod schemas, types, normalize(), detectLang(), constants (used by web + api)
  .github/workflows/
```

## 3. Request pipeline (order matters)

```ts
// backend/src/app.ts
import express from "express";
export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);                 // behind Vercel's proxy → correct req.ip

  app.use(requestId());                      // X-Request-Id in/out
  app.use(logger());                         // pino-http, redacts cookies, words, upi
  app.use(security());                       // helmet: API-safe headers, no CSP needed for JSON
  app.use(express.json({ limit: "8kb" }));   // tiny bodies only
  app.use(session());                        // loads user from sp_sid cookie (cached 60 s)
  app.use("/api", originGuard());            // non-GET: Origin must match + X-SP-Client header

  app.use("/api/v1/health", healthRoutes);
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/config", configRoutes);
  app.use("/api/v1", requireUser, protectedRoutes()); // me, packs, rounds, daily, wallet, map, leaderboard, events
  app.use("/api/v1/jobs", jobsRoutes);       // bearer secret, for GitHub Actions

  app.use(notFound());                       // { error: { code: "NOT_FOUND" } }
  app.use(errorHandler());                   // maps AppError → status + code; never leaks stacks
  return app;
}
```

Express 5 forwards rejected promises from async handlers to the error handler, so controllers are plain `async` functions. Still, every handler ends in a response or a thrown `AppError` — Vercel's docs warn that unhandled Express errors can leave the function in a bad state.

### Validation
Every route declares zod schemas from `shared` for `params`, `query`, `body`, and the response (responses validated in dev/test only).

```ts
router.post("/rounds", rateLimit("round", 60, "1m"), validate({ body: SubmitRoundInput }), submitRound);
```

### Errors

```ts
export class AppError extends Error {
  constructor(public code: ErrorCode, public status: number, message?: string) { super(message ?? code); }
}
// error-handler.ts
res.status(err.status ?? 500).json({ error: { code: err.code ?? "INTERNAL", requestId: req.id } });
```
Codes: `UNAUTHENTICATED 401`, `FORBIDDEN 403`, `NOT_FOUND 404`, `INVALID_INPUT 422`, `RATE_LIMITED 429`, `DAILY_CAP 409`, `STALE_ROUND 409`, `MIN_PAYOUT 409`, `PAID_PAUSED 503`, `INTERNAL 500`. The web app maps codes to short copy (UX_STATES.md).

## 4. Authentication (fastest secure path, free)

No third-party auth service, no passwords. **Anonymous device sessions** with a restore code; phone verification only when real payouts arrive.

| Step | How |
|---|---|
| Start | `POST /api/v1/auth/anon { uiLang, ageConfirmed: true }` → creates `users` row + `sessions` row |
| Session token | 32 random bytes (base64url). Sent as cookie `sp_sid`; **only its SHA-256 hash is stored** |
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=7776000` (90 days), sliding renewal when > 7 days old |
| Load | `session()` middleware hashes the cookie, looks up `sessions` (+ user) — cached per instance for 60 s |
| Restore on a new device | Settings shows an 8-character restore code (Crockford base32, no 0/O/1/I). `POST /auth/restore { code }` → new session, **code rotates**. Rate limited 5/hour/IP |
| Logout | `POST /auth/logout` → session deleted, cookie cleared |
| Revoke all | `POST /auth/logout-all` |
| Later: phone | Link a phone via OTP provider before the first real payout (cost per SMS; out of scope for the free demo) |

Why sessions over JWT: revocable instantly, tiny cookie, no key rotation, no token in JS-reachable storage.

**CSRF:** same-origin cookies with `SameSite=Lax`, plus `originGuard` on every non-GET: `Origin` must be in `ALLOWED_ORIGINS` **and** header `X-SP-Client: web` must be present (a header cross-site forms can't send).

**Device id (fraud signal, not fingerprinting):** the web app stores a random UUID in `localStorage` and sends `X-SP-Device`; the API stores `sha256(deviceId + pepper)`.

## 5. Core service: scoring a round

```ts
// services/rounds controller → scoring.service.ts
export async function submitRound(userId: string, input: SubmitRoundInput) {
  return db.transaction(async (tx) => {
    // 1. Idempotency: attempt id is the primary key
    const existing = await tx.query.answers.findFirst({ where: eq(answers.id, input.attemptId) });
    if (existing) return toResult(existing);

    // 2. Lock the pack row → no double-submit races
    const pack = await lockPack(tx, input.packId, userId);          // SELECT … FOR UPDATE
    assertPromptInPack(pack, input.promptId);
    assertNotAnswered(tx, pack.id, input.promptId);
    assertPlayedAtFresh(input.playedAt);                             // [now-48h, now+5min]

    // 3. Words → concepts
    const words = input.words.map(normalize).filter(Boolean);       // shared
    const concepts = await toConcepts(tx, words);                    // lexicon lookup
    const usable = dropLowInfoAndBurnt(concepts, await burntFor(tx, input.promptId));

    // 4. Gold or normal
    const prompt = await getPrompt(tx, input.promptId);
    const outcome = prompt.isGold
      ? await scoreGold(tx, userId, prompt, usable)                  // updates gold accuracy, 0 ₹
      : await scoreVsPartner(tx, userId, prompt, usable, words);     // exact | bhasha | near | miss

    // 5. Money + XP (pure functions, unit-tested)
    const quality = qualityMultiplier(await goldAccuracy(tx, userId));
    const earnPaise = pack.isPaid ? pay(outcome.result, quality) : 0;
    const xp = xpFor(outcome);

    // 6. Abuse heuristics
    const flagged = input.responseMs < 800;

    // 7. Persist answer (becomes a future partner for others)
    const row = await insertAnswer(tx, { ...input, userId, concepts: usable, outcome, earnPaise, xp, flagged });

    // 8. Side effects
    const newRegion = outcome.isPinch ? await upsertRegion(tx, userId, outcome.partner.stateCode) : null;
    if (outcome.unknownPairs.length) await recordLexiconCandidates(tx, outcome.unknownPairs);

    return toResult(row, { newRegion });
  });
}
```

Pure, unit-tested functions: `normalize`, `pay`, `xpFor`, `qualityMultiplier`, `nextFlame`, `levelFor`, `gradeDaily`, `evaluateBadges`.

**Partner selection** (`partner.service.ts`): same prompt; not the same user; not the same device hash; not flagged; prefer authors with gold accuracy ≥ 0.75; random among the 20 most recent qualifying answers (`ORDER BY random() LIMIT 1` inside a CTE of 20). Seeded partners guarantee a result for every prompt.

## 6. Lazy jobs (no cron service needed)

| Job | Trigger | Logic |
|---|---|---|
| Burnt words | On `GET /packs/next`, for each prompt whose `burnt_checked_at` is older than 15 min | Recompute top concepts over the last 50 answers; burn any > 40% |
| Leaderboard | On `GET /leaderboard`, cached 60 s per scope in memory | One SQL aggregate over this week's `answers.xp` |
| Daily set | On `GET /daily` | Deterministic: `hash(date + salt)` picks 5 eligible prompts; stored on first request of the day |
| Demo payouts | On `GET /wallet` | Mark `pending` payouts older than 60 s as `paid` |
| Event pruning | `POST /api/v1/jobs/prune` from a weekly GitHub Action with a bearer secret | Delete events > 90 days |

## 7. Rate limiting (Postgres-backed, no Redis)

```ts
// middleware/rate-limit.ts
export const rateLimit = (bucket: string, max: number, window: "1m" | "1h" | "1d") =>
  async (req, _res, next) => {
    const key = req.user?.id ?? `ip:${req.ip}`;
    const count = await hit(key, bucket, window);   // INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count
    if (count > max) throw new AppError("RATE_LIMITED", 429);
    next();
  };
```
Limits are listed in SECURITY.md §3. Add Vercel Firewall rate-limit rules for IP-level floods.

## 8. Config & environment

```ts
// config.ts
const Env = z.object({
  DATABASE_URL: z.string().url(),            // Neon pooled connection string (…-pooler…)
  SESSION_PEPPER: z.string().min(32),
  DEVICE_PEPPER: z.string().min(32),
  JOBS_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string(),               // comma-separated
  DEMO_MODE: z.enum(["true", "false"]).default("true"),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]),
});
export const env = Env.parse(process.env);   // crash on boot if misconfigured
```

## 9. Database access

```ts
// db/client.ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
const sql = postgres(env.DATABASE_URL, {
  max: 5,                 // small pool per instance; Neon's pooler fans in
  prepare: false,         // required with PgBouncer transaction pooling
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(sql, { schema });
```
- Migrations: `drizzle-kit generate` → SQL files committed → `drizzle-kit migrate` in CI before deploy.
- Every query goes through Drizzle (parameterised). No string-built SQL with user input.
- Money stored as integer **paise**.

## 10. Logging & monitoring

- `pino` JSON logs with `requestId`, `userId` (hashed), route, status, duration. Redact: cookies, `words`, `upi`, `code`.
- Sentry Node SDK (free Developer plan) for exceptions, 10% traces.
- `/api/v1/health` → `{ ok, db: "up", version }` for uptime checks.

## 11. Local development

```bash
npm run setup                           # root: installs shared/, backend/, frontend/ separately
npm run db:up                           # backend/docker-compose.yml → Postgres 16 on :5433
cp backend/.env.example backend/.env    # DATABASE_URL=postgres://postgres:dev@localhost:5433/samepinch
npm run db:migrate --prefix backend && npm run db:seed --prefix backend
npm run dev                             # concurrently: api on :3001, web on :5173
```
`frontend/vite.config.ts` proxies `/api` → `http://localhost:3001`, matching production's same-origin setup.

## 12. Testing

- Unit: pure services (pay, flame, scoring tiers, normalise) with Vitest.
- API: `supertest(buildApp())` against a disposable Postgres (Docker locally; a Neon branch or `postgres` service container in CI).
- Must-have tests: idempotent submit, cross-user access denied, gold fields never in responses, rate limit 429, payout rules, CSRF guard rejects missing header/wrong origin.
