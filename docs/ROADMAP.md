# ROADMAP.md — 5-day build plan

Deadline: 5 days from the brief. Rule: **a smaller thing that works end to end beats a big thing half done.** Every day ends with a deployed, playable build.

## Day 1 — Foundations + the core loop on fake data
- [ ] Monorepo (`frontend`, `backend`, `shared`); Vite + TS + Tailwind v4 + shadcn init; **all tokens in `theme.css`**; fonts
- [ ] Rewrite primitives: Button, Switch, Tabs, Drawer, Progress to tokens
- [ ] Build: Card, NightCard, GradientCard, GlassCard, BhashaPlate, IconTile, ListRow, SectionHeader, BottomNav
- [ ] Routes + AppShell with **BottomNav / NavRail / Sidebar**; Today screen (phone, tablet, desktop layouts) with static data
- [ ] Static app shell in `index.html`, 404 page, route skeletons
- [ ] Play screen with local mock partner + matching function in TS (temporary) → flip + stamp animations
- [ ] Deploy to Vercel/CF preview
**Done when:** you can play 10 mock rounds on your phone and the PINCH moment feels great.

## Day 2 — Real backend
- [ ] Neon project (Asia region) + Express 5 API skeleton (middleware pipeline, error handler, config) — BACKEND.md
- [ ] Drizzle schema + migrations; `app_user` role
- [ ] Seed: 60 prompts (start smaller), lexicon for EN/HI/KN (~300 concepts), 5 seeded partners each, gold prompts
- [ ] Anonymous sessions (cookie) + origin guard + rate limiter
- [ ] `POST /packs`, `POST /rounds`, `POST /packs/:id/collect` (+ supertest: idempotency, access control, gold never leaked)
- [ ] Deploy API + web on Vercel with the `/api` rewrite; wire Play to the API; delete the mock matcher
- [ ] Results screen + Collect animation; ledger rows
**Done when:** a fresh anonymous user plays a real pack and sees ₹ + XP in the database.

## Day 3 — Retention layer
- [ ] Flame + freeze logic (server) and Today Night card states
- [ ] XP levels + level-up overlay
- [ ] Burnt Words (cron + UI)
- [ ] Think Like India: `/daily` endpoints, screen, share grid
- [ ] Sync Map SVG + region unlocks
- [ ] Badges (12) + unlock sheet
**Done when:** a 3-day simulated history (seed demo user) looks alive across all screens.

## Day 4 — Offline, wallet, polish
- [ ] Dexie stores, pack prefetch (keep 2), answer queue, sealed offline reveal, flush on reconnect
- [ ] PWA manifest, icons, SW, install prompt, update toast
- [ ] Wallet: stat tiles, segmented, timeline, payout (demo) flow
- [ ] Leaderboard (weekly rollup) + Settings with Fair Play Promise
- [ ] Onboarding slides with real photos + language screen; i18n for HI/KN
- [ ] Data Saver, reduced motion, haptics/sound toggles
**Done when:** airplane-mode play works and the app installs on Android.

## Day 5 — Quality + submission
- [ ] Playwright journeys at 3 viewports + axe; **Lighthouse ≥ 95 in all categories, mobile + desktop**; size budget green
- [ ] Responsiveness pass in Responsively App across the viewport list
- [ ] Real low-end Android test; fix jank
- [ ] Security checklist; headers; CSP enforced
- [ ] README: live link, 60-second demo script, screenshots/GIF, research rationale, architecture diagram, known limitations, what I'd do next
- [ ] Record a 60–90 s screen recording of: onboarding → pack → Bhasha pinch → collect → flame → map → daily share
- [ ] Reply to the email (below)

## Cut list (if behind schedule, cut in this order)
1. Leaderboard → static "coming soon" card
2. Tamil UI
3. Sound prompts (keep image/vibe/question)
4. Payout flow (keep ledger)
5. Sync Map → simple list of states
**Never cut:** the flip/PINCH moment, server-side scoring, streak, offline play, ledger.

## Submission email (draft)

> Subject: Same Pinch — build task submission (Vivek Tarnallya)
>
> Hi team,
>
> Here's my submission: **Same Pinch** — two strangers see the same picture, sound or question and each drop up to three words. If any word matches — even across languages (*naayi* = *kutta* = *dog*) — it's a "Same Pinch" and both earn.
>
> **Live app:** <link> (open on a phone; works offline after first load)
> **Code:** <repo link> · **60-second walkthrough:** <video link>
>
> A few choices I made for your users:
> - Plays fully offline against recorded partners; a 10-round pack is under 200 KB, and Lighthouse scores are 95+ on mobile and desktop.
> - Separate layouts for phone, tablet and desktop rather than one stretched screen.
> - Icon-first UI with voice-friendly input and Hindi/Kannada support.
> - Pay is for verified matches only — never for winning or luck — in line with India's 2025 online gaming law. The ledger can't go down because of a broken streak.
> - Two strangers agreeing is the quality check (the ESP Game idea), plus hidden test prompts that tune pay.
>
> The README covers the research behind the mechanics, the architecture, and what I'd build next.
>
> Thanks for the interesting brief!
> Vivek

## After the deadline (v2 ideas)
Pinch Pals with shared flame · Voice Drop with on-device speech · Brain Wrapped weekly card · Hive 4-player mode · real UPI payouts via a payout partner with KYC · more languages (Telugu, Marathi, Bengali) · admin console for lexicon review.
