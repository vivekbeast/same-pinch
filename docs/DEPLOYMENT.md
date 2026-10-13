# DEPLOYMENT.md — laptop to live URL (free)

Services and their free tiers: **FREE_STACK.md**. This file is the how-to.

## 1. Environments

| Env | Web | API | Database |
|---|---|---|---|
| local | `vite` on :5173 (proxies `/api`) | `tsx watch` on :3001 | Docker Postgres 16 (or a Neon `dev` branch) |
| preview | Vercel preview per PR | Vercel preview per PR | Neon `preview` branch |
| production | `samepinch.vercel.app` | `samepinch-api.vercel.app` (reached via `/api` rewrite) | Neon `main` branch (Asia region) |

## 2. Environment variables

`backend/.env.example`
```bash
NODE_ENV=development
DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres
SESSION_PEPPER=change-me-to-48-random-bytes-base64
DEVICE_PEPPER=change-me-to-48-random-bytes-base64
JOBS_SECRET=change-me-to-48-random-bytes-base64
ALLOWED_ORIGINS=http://localhost:5173
DEMO_MODE=true
SENTRY_DSN=
```

`frontend/.env.example`
```bash
VITE_APP_ENV=local          # local | preview | production
VITE_SENTRY_DSN=
VITE_DEMO_MODE=true
```
The web app needs no API URL — it always calls the relative `/api/v1`.

## 3. Database (Neon)

1. Create project in the Asia region nearest India; note the **pooled** connection string.
2. Create roles: `app_user` (DML only) for the API, owner role for migrations.
   ```sql
   create role app_user login password '…';
   grant usage on schema public to app_user;
   grant select, insert, update on all tables in schema public to app_user;
   grant delete on sessions, rate_limits, events to app_user;
   grant usage, select on all sequences in schema public to app_user;
   alter default privileges in schema public grant select, insert, update on tables to app_user;
   ```
3. Migrate and seed (from CI or once from your laptop):
   ```bash
   DATABASE_URL=$OWNER_URL npm run db:migrate --prefix backend
   DATABASE_URL=$OWNER_URL npm run db:seed --prefix backend
   ```
4. Create a `preview` branch from `main` for preview deployments.

## 4. API on Vercel (Express, zero config)

- New Vercel project → import repo → **Root Directory `backend`**.
- Entry `backend/src/index.ts` default-exports the Express app (Vercel detects Express automatically):
  ```ts
  import { buildApp } from "./app";
  const app = buildApp();
  export default app;
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) app.listen(3001);
  ```
- Settings → Functions → **Region** next to the DB (e.g. `sin1` for Singapore, `bom1` for Mumbai).
- Env vars from §2 (production values) for Production and Preview (preview uses the Neon `preview` branch URL).
- `express.static` is ignored on Vercel — fine, the API serves JSON only.

`backend/vercel.json`
```json
{
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Cache-Control", "value": "no-store" },
      { "key": "X-Content-Type-Options", "value": "nosniff" }
    ]}
  ]
}
```

## 5. Web on Vercel

- New Vercel project → same repo → **Root Directory `frontend`**, framework **Vite**.

`frontend/vercel.json`
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://samepinch-api.vercel.app/api/:path*" },
    { "source": "/((?!assets/|prompts/|onboarding/|sounds/|icons/|sw.js|workbox-|manifest.webmanifest|offline.html|robots.txt).*)", "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/prompts/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/(sw.js|index.html)", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/(.*)", "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self' https://*.ingest.sentry.io; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" },
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
    ]}
  ]
}
```
- Preview deployments: point the rewrite at the API preview URL with an env-driven `vercel.json` generated in the build step, or keep previews on the production API with `DEMO_MODE` data (simplest for a 5-day build).
- Unknown paths fall through to `index.html`, so the SPA's 404 page renders (UX_STATES.md §5).

## 6. CI/CD (GitHub Actions)

`.github/workflows/ci.yml`
```yaml
name: ci
on: { pull_request: {}, push: { branches: [main] } }
permissions: { contents: read }
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgres://postgres:test@localhost:5432/postgres
      SESSION_PEPPER: ci-pepper-ci-pepper-ci-pepper-ci-pepper-1234
      DEVICE_PEPPER: ci-device-ci-device-ci-device-ci-device-1234
      JOBS_SECRET: ci-jobs-ci-jobs-ci-jobs-ci-jobs-ci-jobs-12345
      ALLOWED_ORIGINS: http://localhost:4173
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci && npm ci --prefix shared && npm ci --prefix backend && npm ci --prefix frontend
      - run: npm run lint && npm run typecheck
      - run: npm run db:migrate --prefix backend && npm run db:seed --prefix backend
      - run: npm test
      - run: npm run build
      - run: npx size-limit
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e --prefix frontend           # starts api + web preview
      - run: npx @lhci/cli autorun --config=lighthouserc.json
      - run: npx @lhci/cli autorun --config=lighthouserc.desktop.json
      - uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }

  migrate-prod:
    if: github.ref == 'refs/heads/main'
    needs: verify
    runs-on: ubuntu-latest
    environment: production                    # manual approval
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run db:migrate --prefix backend
        env: { DATABASE_URL: "${{ secrets.DATABASE_URL_OWNER }}" }
```
Vercel's Git integration deploys both projects (preview on PR, production on `main`). Keep migrations **backward compatible** (add first, remove later) because the new frontend and API may go live a minute apart.

Scheduled workflows: `keep-warm.yml` (FREE_STACK.md §3) and `weekly-jobs.yml`:
```yaml
on: { schedule: [{ cron: "0 22 * * 0" }] }   # Mondays 03:30 IST
jobs:
  prune:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.JOBS_SECRET }}" https://samepinch.vercel.app/api/v1/jobs/prune
```

Root `package.json` scripts
```json
{
  "scripts": {
    "dev": "concurrently -n api,web \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\"",
    "setup": "npm i && npm i --prefix shared && npm i --prefix backend && npm i --prefix frontend",
    "lint": "npm run lint --prefix shared && npm run lint --prefix backend && npm run lint --prefix frontend",
    "typecheck": "npm run typecheck --prefix shared && npm run typecheck --prefix backend && npm run typecheck --prefix frontend"
  }
}
```

`.size-limit.json`
```json
[{ "path": "frontend/dist/assets/index-*.js", "limit": "150 KB", "gzip": true }]
```

## 7. PWA release hygiene

- `registerType: "prompt"`: when a new service worker is waiting, show "New version ready — Refresh". Never reload mid-pack.
- `sw.js` and `index.html` are `no-cache`; hashed assets are immutable.
- Test: install → deploy → reopen → toast → refresh → new version.

## 8. SEO & meta basics (needed for Lighthouse SEO ≥ 95)

- `index.html`: `<html lang="en">`, title, meta description, canonical, Open Graph image (1200×630), `theme-color` `#5A3BE7`, viewport with `viewport-fit=cover`.
- `robots.txt`: allow `/`, disallow `/play/`, `/wallet`, `/api/`.
- 404 page sets `noindex`.

## 9. Monitoring & operations

| What | How |
|---|---|
| Errors | Sentry browser (lazy-loaded) + Node SDK, 10% traces, PII scrubbing |
| Logs | Vercel function logs (pino JSON) |
| Vitals | `web-vitals` → `/events` |
| Uptime | UptimeRobot on `/api/v1/health` |
| Business | SQL views in Neon console: DAU, D1/D7, pinch rate, gold accuracy, pending payouts |
| Abuse | Weekly query: flagged answers, top earners, repeat-match pairs |

## 10. Rollback & kill switch

- Web/API: Vercel **Instant Rollback** to the previous deployment.
- DB: forward-only migrations; ship a fix migration. Data incidents: restore a Neon branch from history, diff, apply targeted fixes.
- Kill switch: `game_config.paid_enabled = false` → API returns `PAID_PAUSED` for paid actions; UI shows a banner; XP play continues.

## 11. Go-live checklist

- [ ] Neon `main` migrated + seeded; API uses `app_user`
- [ ] Both Vercel projects deployed; `/api/v1/health` returns `db: "up"` through the web origin
- [ ] Cookie set on the web origin (DevTools → Application → Cookies)
- [ ] Lighthouse ≥ 95 in all four categories, mobile **and** desktop (median of 5), on the live URL via PageSpeed Insights
- [ ] Responsive check across the viewport list (RESPONSIVE.md §5)
- [ ] Offline play on a real phone (airplane mode) + install prompt works
- [ ] Security checklist (SECURITY.md §9) done
- [ ] Sentry receives a test error; UptimeRobot green
- [ ] README has the live URL, demo steps, screenshots, limitations
