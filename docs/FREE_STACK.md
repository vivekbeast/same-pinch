# FREE_STACK.md — ₹0 infrastructure, fastest path to a live app

Goal: a reviewer opens a link and everything works, on free tiers, set up in about an hour.

> Free-tier limits change often. The numbers below were checked in October 2026; re-check each pricing page before relying on them.

## 1. The chosen stack

| Need | Service | Free tier (key limits) | Why this one |
|---|---|---|---|
| Frontend hosting + CDN | **Vercel** (Hobby) | Static hosting, global CDN, preview per PR; Hobby is for non-commercial use | Zero-config Vite, India edge locations, same project style as the API |
| API (Node + Express) | **Vercel Functions** (Hobby, Fluid compute) | Express deploys with zero config as one function; free monthly CPU/memory allowance | No sleeping server like other free hosts; same platform as the web app → simple same-origin rewrite |
| Database | **Neon Postgres** (Free) | 1 GB storage/project, 100 CU-hours/project/month, scale-to-zero after 5 min idle | Real Postgres, branching for tests, pooled connections built in |
| Prompt images & audio | **Vercel static** (`frontend/public/prompts`) | Part of the CDN | No extra service; hashed filenames → cache forever |
| Rate limiting & jobs | **Postgres** (same DB) | — | No Redis, no cron service |
| Scheduled pings / weekly job | **GitHub Actions** (scheduled workflow) | Free minutes for public repos (generous for private) | Calls `/api/v1/jobs/*` with a secret |
| Errors | **Sentry** (Developer, free) | Limited events/month | Browser + Node SDKs |
| Uptime | **UptimeRobot** (free) | 5-minute checks | Alerts if the demo is down |
| Domain | `*.vercel.app` | Free | A custom domain is optional |

**Cost: ₹0.** No credit card needed for any of these at demo scale.

## 2. Alternatives (and why they're second choice)

| Option | Status | Trade-off |
|---|---|---|
| **Render** free web service | Spins down after 15 min idle; spin-up ≈ 1 minute; 750 instance-hours/month; free Postgres expires after 30 days | A reviewer hitting a cold API waits ~1 min — bad first impression. Use only with a keep-warm ping, and never its free DB |
| **Railway** | $5 one-time trial credit, then ~$1/month credit; always on; no card for trial | Good always-on Express host; credit may not last a long review period |
| **Google Cloud Run** | Generous free tier, Mumbai region, scales to zero | Needs a billing account (card); more setup |
| **Koyeb** | No free compute for new users since Feb 2026 | — |
| **Fly.io** | No ongoing free tier for new accounts | — |
| **Supabase** (as plain Postgres) | Free Postgres in Mumbai region; free projects pause after a period of inactivity | Fine alternative DB; use its connection pooler URL with `prepare: false` |
| **Upstash Redis** | Free tier | Not needed — Postgres handles rate limits at this scale |

## 3. Neon compute budget (important)

Neon free gives **100 CU-hours per project per month** and always scales to zero after 5 minutes idle. At the minimum size (0.25 CU), staying awake 24/7 would use ≈ 180 CU-hours — **over the limit**. So:

- **Don't** keep the DB warm around the clock.
- Cold start (DB waking) adds roughly half a second to a second on the first request; the web app hides this behind the skeleton + IndexedDB cache.
- **No keep-warm ping** (D56). The game is offline-first: packs are prefetched to IndexedDB, rounds play without the
  network and answers sync later, so the 1–3 s wake-up only touches the first API call after a quiet spell. A
  GitHub Actions ping every 5 minutes would also cost ≈ 3,400 Actions minutes a month on a private repo, more
  than the free 2,000, and running out stops CI. If you want a down-alert later, use a free external monitor
  (UptimeRobot, cron-job.org) on `/api/v1/health`; it costs no Actions minutes.

## 4. Region choice

- Create the Neon project in the **Asia region closest to India** that the console offers (e.g., Singapore).
- Set the API project's **Function Region** in Vercel to the matching nearby region (Singapore `sin1`, or Mumbai `bom1` if the DB is in Mumbai). Keeping the function next to the DB matters more than keeping it next to the user — each request makes several DB round-trips but only one user round-trip.

## 5. One-hour setup

1. **GitHub:** create the repo (layout from BACKEND.md §2: frontend/, backend/, shared/).
2. **Neon:** sign up → new project (Asia region) → copy the **pooled** connection string (host contains `-pooler`) → create a `dev` branch for local testing if you don't want Docker.
3. **Vercel – API project:** "Add New Project" → import repo → Root Directory `backend` → env vars: `DATABASE_URL`, `SESSION_PEPPER`, `DEVICE_PEPPER`, `JOBS_SECRET` (generate with `openssl rand -base64 48`), `ALLOWED_ORIGINS=https://samepinch.vercel.app`, `DEMO_MODE=true`, `NODE_ENV=production` → Settings → Functions → Region.
4. **Run migrations + seed** from your laptop once: `DATABASE_URL=… npm run db:migrate --prefix backend && npm run db:seed --prefix backend`.
5. **Vercel – Web project:** import the same repo → Root Directory `frontend` → framework Vite → add the rewrite (DEPLOYMENT.md) pointing `/api/*` to the API project URL.
6. **Sentry:** create two projects (browser, node), add DSNs as env vars.
7. **UptimeRobot:** HTTP monitor on `/api/v1/health`.
8. **GitHub Actions:** add `DATABASE_URL` (for migrations) and the Vercel/Sentry tokens as secrets; enable CI (DEPLOYMENT.md §5).
9. Open the URL on your phone → play a pack → check the `answers` table in the Neon console.

## 6. What changes when it's real

| Area | Demo (free) | Production |
|---|---|---|
| Payouts | Simulated ledger, "Demo money" banner | Payout partner with KYC (UPI payouts), phone OTP verification |
| Hosting | Vercel Hobby (non-commercial) | Vercel Pro or Cloud Run in Mumbai |
| DB | Neon Free | Neon/Supabase paid with PITR backups, read replica for analytics |
| Auth | Anonymous + restore code | + phone OTP linking |
| Jobs | Lazy + GitHub Actions | Proper scheduler (Vercel Cron / Cloud Scheduler) |
