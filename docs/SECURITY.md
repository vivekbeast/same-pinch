# SECURITY.md — threat model, controls, checklist

Real money attracts cheaters. Assume every client is hostile; the browser is only a display. All decisions happen in the Express API (BACKEND.md).

## 1. Assets to protect

1. User balances and payouts (₹)
2. Data quality — label integrity, gold prompts, the lexicon
3. User privacy (handles, coarse location, UPI IDs, future phone numbers)
4. Availability and cost (free-tier limits are easy to exhaust)

## 2. Threats & controls

| # | Threat | Control |
|---|---|---|
| T1 | Read partner answers before submitting | Partner words only appear in the `POST /rounds` response after the player's answer is stored; no endpoint lists other users' answers |
| T2 | Identify gold prompts | DTO mappers whitelist fields — `isGold`/`goldConcepts` never serialised; gold rounds show a seeded partner like any other round |
| T3 | Forge results / XP / money | Client sends only words; server computes everything inside a DB transaction |
| T4 | Replay a submission for double pay | `attemptId` is the primary key of `answers`; `unique(user, pack, prompt)`; pack row locked `FOR UPDATE`; collect stores and returns its summary (idempotent) |
| T5 | Bots / scripts farming | Rate limits, response-time anomaly flags, daily paid cap, gold-accuracy pay multiplier, phone verification before real payouts |
| T6 | Collusion between friends | Partners are recorded strangers chosen server-side, never live; same-device-hash exclusion; flags for pairs that keep matching |
| T7 | Multi-accounting | Device hash heuristic now; one payout identity per verified phone later; linked flagged accounts can't pay out |
| T8 | Low-effort spam words | Low-info list, burnt words, quality multiplier down to 0.5× |
| T9 | Time travel (offline streak abuse) | `playedAt` accepted only within [now − 48 h, now + 5 min]; server computes the day in the user's timezone |
| T10 | XSS | React escaping; **no** `dangerouslySetInnerHTML`; handle regex `^[a-z0-9_]{3,20}$`; strict CSP with `script-src 'self'` |
| T11 | CSRF | Same-origin cookies `SameSite=Lax`; non-GET requires matching `Origin` **and** `X-SP-Client: web` header |
| T12 | Session theft | HttpOnly + Secure cookie; only SHA-256 of the token stored; sessions revocable (`logout-all`); 90-day sliding expiry |
| T13 | SQL injection | Drizzle parameterised queries only; lint rule bans `sql.raw` with variables; DB user has no DDL rights |
| T14 | Restore-code brute force | 8 chars of Crockford base32 (~10¹²), hashed at rest, 5 attempts/hour/IP, rotates on use |
| T15 | Payout fraud | UPI format validation, 3/day limit, 24 h cooling on first payout or UPI change, review queue for anomalies; phone OTP before real money |
| T16 | Cost exhaustion (free tiers) | Request body 8 KB max, rate limits, CDN-cached immutable assets, Vercel Firewall rules, Neon compute budget (FREE_STACK.md §3) |
| T17 | Lexicon scraping (answer lookup bots) | Lexicon never sent to clients; burnt words only per prompt |
| T18 | Clickjacking | `frame-ancestors 'none'` |
| T19 | Supply chain | Lockfile committed, `npm audit --omit=dev`, Dependabot, minimal deps, `gitleaks` |
| T20 | Error/info leakage | Error handler returns only `code` + `requestId`; stack traces only in logs; `x-powered-by` disabled |

## 3. Rate limits (Postgres fixed window, BACKEND.md §7)

| Route | Limit | Key |
|---|---|---|
| `POST /auth/anon` | 20 / hour | IP |
| `POST /auth/restore` | 5 / hour | IP |
| `POST /packs` | 10 / hour | user |
| `POST /rounds` | 60 / minute | user |
| `POST /packs/:id/collect` | 20 / hour | user |
| `POST /daily/:day/answers` | 10 / day | user |
| `POST /wallet/payouts` | 3 / day | user |
| `PATCH /me` | 20 / hour | user |
| `POST /events` | 120 / hour | user |
| Everything | Vercel Firewall rule for IP floods | IP |

Responses include `Retry-After`.

## 4. HTTP security headers

**Web (set in `frontend/vercel.json`):**

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self';
  font-src 'self';
  connect-src 'self' https://*.ingest.sentry.io;
  worker-src 'self';
  manifest-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), geolocation=(), microphone=(self), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

Because the API is proxied on the same origin, `connect-src 'self'` covers it. `style-src 'unsafe-inline'` is needed for libraries that inject `<style>` (sonner/vaul); Motion uses CSSOM, which CSP allows. Ship CSP as `Report-Only` for a day, fix console reports, then enforce. Add `preload` to HSTS only on a custom domain you control fully.

**API (helmet):** `helmet({ contentSecurityPolicy: false /* JSON only */, crossOriginResourcePolicy: { policy: "same-origin" } })`, plus `Cache-Control: no-store` on all authenticated responses.

## 5. Auth & sessions

See BACKEND.md §4. Summary: anonymous sessions, opaque 32-byte token in an HttpOnly/Secure/SameSite=Lax cookie, SHA-256 stored server-side with a pepper, 90-day sliding expiry, restore code for device change, logout and logout-all.

## 6. Privacy (India DPDP Act, 2023 — design principles, not legal advice)

- **Notice & consent** in onboarding: one short screen — what we collect (answers, handle, coarse state, optional city), why (the game + anonymised data that teaches computers Indian languages), how long.
- **Minimisation:** no precise location, no contacts, no fingerprinting; device id is a random UUID, stored only as a salted hash. UPI stored masked in the demo.
- **Rights:** `GET /me/export` and `DELETE /me` (profile deleted; answers anonymised).
- **Age:** the demo requires "I am 18 or older" to start. Under-18 support would need verifiable parental consent — out of scope.
- No ad SDKs, no third-party trackers, no third-party fonts.

## 7. Secrets & config

| Secret | Where |
|---|---|
| `DATABASE_URL` (app role) | Vercel API project env (Production/Preview) |
| `DATABASE_URL_OWNER` (migrations) | GitHub Actions secret only |
| `SESSION_PEPPER`, `DEVICE_PEPPER`, `JOBS_SECRET` | Vercel API env; generated with `openssl rand -base64 48` |
| `SENTRY_DSN` | Vercel env (public-ish) |
| `SENTRY_AUTH_TOKEN`, `VERCEL_TOKEN` | GitHub Actions secrets |

The web build has **no secrets** — it only knows the relative path `/api/v1`. `.env*` git-ignored; `gitleaks` runs in CI.

## 8. Security tests (must pass in CI)

Vitest + supertest against a disposable Postgres:
- User A cannot read user B's ledger, payouts, packs, answers (`404`, not `403`, to avoid enumeration).
- `POST /rounds` with another user's `packId` → `404`.
- Replaying the same `attemptId` returns the same body and doesn't change the balance.
- Pack and round responses never contain `isGold`, `goldConcepts`, other users' IDs, or partner words before submit.
- Non-GET without `X-SP-Client` or with a foreign `Origin` → `403`.
- Rate limits return `429` with `Retry-After`.
- Payout above balance → `409`; below ₹50 → `MIN_PAYOUT`.
- Restore code: wrong code 6× → `429`; successful restore rotates the code.

## 9. Pre-launch security checklist

- [ ] All security tests green; `npm audit --omit=dev` has no high/critical
- [ ] CSP enforced; securityheaders.com grade A on the web origin
- [ ] Cookies verified in DevTools: HttpOnly, Secure, SameSite=Lax
- [ ] No secrets in the web bundle (`grep -rE "pepper|DATABASE_URL|secret" frontend/dist` empty)
- [ ] API connects with the least-privilege `app_user` role
- [ ] Logs redact cookies, words, UPI, restore codes; Sentry PII scrubbing on
- [ ] Rate limits load-tested (k6, 2 minutes) on a preview deployment
- [ ] Neon backups/snapshot taken before go-live; restore tested once on a branch
- [ ] Privacy, Terms and "How we pay" pages linked from Settings
- [ ] `/.well-known/security.txt` with a contact email
