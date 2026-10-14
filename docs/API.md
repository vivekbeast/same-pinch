# API.md — REST contract (Express)

> Implemented in `backend/src/routes/`. Request/response shapes are the zod schemas in `shared/src/api.ts`; changes made while building are in `docs/DECISIONS.md` D22–D25.

Base path: `/api/v1`. JSON only. Same origin as the web app (proxied), so the session cookie travels automatically.

**Every non-GET request must send:** `Content-Type: application/json`, `X-SP-Client: web`, `X-SP-Device: <uuid>`. Requests without them get `403 FORBIDDEN`.

Shared zod schemas for every request/response live in `shared/src/api.ts` and are used by both the web client and the server.

## Error format

```json
{ "error": { "code": "RATE_LIMITED", "requestId": "01J…" } }
```

| Code | Status | UI copy |
|---|---|---|
| `UNAUTHENTICATED` | 401 | (silently re-runs anon sign-in) |
| `FORBIDDEN` | 403 | "Something looks off. Refresh and try again." |
| `NOT_FOUND` | 404 | "This isn't available." |
| `INVALID_INPUT` | 422 | "Something looks off. Try again." |
| `DAILY_CAP` | 409 | "Today's paid packs are done. Play more for XP!" |
| `STALE_ROUND` | 409 | "This round is too old to count." |
| `MIN_PAYOUT` | 409 | "You need ₹50 to send money." |
| `RATE_LIMITED` | 429 | "Slow down a little — try again in a minute." (+ `Retry-After`) |
| `PAID_PAUSED` | 503 | "Paid play is paused for a short while. XP still counts." |
| `INTERNAL` | 500 | "Something broke on our side." |

---

## Health & config

### `GET /health` → `200 { ok: true, db: "up", version: "1.0.3" }`
### `GET /config` (public, cached 5 min)
```json
{ "paidEnabled": true, "demoMode": true, "minPayoutPaise": 5000, "paidPacksPerDay": 5,
  "roundSeconds": { "default": 20, "sound": 25 }, "languages": ["en","hi","kn","ta"] }
```

## Auth

| Method & path | Body | Response | Limit |
|---|---|---|---|
| `POST /auth/anon` | `{ uiLang, ageConfirmed: true, termsAccepted: true, stateCode, city? }` (D45) | `201 { user: Me }` + `Set-Cookie: sp_sid=…` | 20/hour/IP |
| `POST /auth/restore` | `{ code: "8 chars" }` | `200 { user: Me }` + new cookie; code rotates | 5/hour/IP |
| `POST /auth/logout` | — | `204`, cookie cleared | — |
| `POST /auth/logout-all` | — | `204` | 5/day |
| `POST /auth/demo` | — | `200 { user: Me }` signs into the shared demo account (DEMO_MODE only) | 20/hour/IP |
| `POST /auth/restore-code` | — | `200 { code }` rotates and shows the restore code (Settings) | 10/day |

## Securing the account with Google (stage 2) — docs/DECISIONS.md D27–D28

Browser navigations (not fetch): the server-side OAuth redirect flow.

| Method & path | Notes |
|---|---|
| `GET /auth/google/start?intent=login|link&returnTo=/path` | 302 → Google. `link` needs a session. Sets the `sp_oauth` flow cookie. 30/hour/IP |
| `GET /api/auth/google/callback?code&state` | The registered redirect URI (outside `/api/v1`). 302 → `APP_ORIGIN + returnTo` with `signed_in=google`, `linked=google` or `auth_error=…`; sets `sp_sid` on sign-in |
| `DELETE /auth/link/google` | `200 { user: Me }` |

`Me` includes `identities: { provider: "google", display, linkedAt }[]` and `payout: { mode, eligible, needs: ("identity"|"kyc")[] }`.
`POST /wallet/payouts` returns `VERIFICATION_REQUIRED 409` until `needs` is empty (stage 3). `GET /config` includes `linking: { google }` and `payoutMode`.

## Me

### `GET /me` → `Me`
```ts
type Me = {
  id: string; handle: string; avatar: string; uiLang: Lang; stateCode: string | null; city: string | null;
  xp: number; level: { value: number; nameKey: string; progress: [number, number] };
  flame: { value: number; best: number; freezes: number; safeToday: boolean };
  paidPacksLeftToday: number; balancePaise: number; pendingPaise: number;
  restoreCode: string;   // only returned on GET /me, never in lists
};
```
### `PATCH /me` `{ handle?, avatar?, uiLang?, stateCode?, city?, tz?, settings? }` → `Me` (20/hour)
### `GET /me/badges` → `{ earned: BadgeId[], all: Badge[] }`
### `GET /me/export` → JSON download of the user's data (2/day)
### `DELETE /me` → `204` (deletes profile, anonymises answers)

## Packs & rounds (the game)

### `POST /packs` → create/get the next pack (30/hour; 5-round packs, D42)
```json
{
  "packId": "uuid", "isPaid": true,
  "rounds": [
    { "promptId": "uuid", "kind": "image", "asset": { "src": "/prompts/3f9a….webp", "srcset": "/prompts/3f9a-320.webp 320w, …" },
      "textKey": "prompt.what_do_you_see", "burnt": ["dog", "animal"], "seconds": 20 }
  ]
}
```
Gold prompts look exactly like normal rounds. Partner answers are **never** included. Response also has `answered: promptId[]`.

### `GET /packs/:packId` → same shape as above (resume an interrupted pack)

### `POST /rounds` → submit one round (60/min)
```ts
// request
{ attemptId: uuid, packId: uuid, promptId: uuid,
  words: { text: string, lang: Lang }[0..3], playedAt: ISODate, responseMs: number,
  pinch?: { x: 0..1000, y: 0..1000 } | null }   // photo rounds only (D39); otherwise 422

// response
{
  result: "exact" | "bhasha" | "near" | "miss" | "skipped",
  you:     { text: string; lang: Lang; matched: boolean; burnt: boolean }[],
  partner: { handle: string; avatar: string; stateCode: string;
             words: { text: string; lang: Lang; matched: boolean }[];
             together: number },  // pinches you'd shared with them before this round (rematch chip)
  xp: number,
  hot: boolean,             // hot hand bonus applied (XP ×2, never ₹)
  earnPaise: number,        // provisional until the pack is collected
  newRegion?: string,
  // Pinch the Picture (D39): where you both pinched; partner is null if they didn't pinch
  spot: { you: {x, y}; partner: {x, y} | null; same: boolean;
          // everyone else's pinches, binned: [x, y, count] at cell centres, busiest first (≤ 60);
          // near = % within the same-spot radius of yours. null until ≥ crowd.minAnswers others pinched.
          crowd: { n: number; near: 0..100; cells: [x, y, count][] } | null } | null
}
```
- **Idempotent** on `attemptId`: resending returns the same result, never double-pays.
- No words **and** no pinch = `skipped`. A pinch alone is a played round (result `miss` unless words matched).
- Same spot = within `pinch.sameSpot` (170 on the 0–1000 grid) of the partner's pinch → `+pinch.spotXp` XP, **never ₹**.
- `playedAt` must be within the last 48 h and not more than 5 min in the future.
- **Crowd** is computed only inside the response, after the answer is stored: nobody sees where others pinched before
  committing. Flagged answers and your own never count.
- **Hot hand** (`HOT_HAND` in shared): the last 3 results in this pack were pinches and `responseMs` ≤ half the round's
  seconds (+1 s grace) → XP ×2. The client shows the shortened timer; the server decides.

### `GET /words` → Smart Chips word lists (public, `Cache-Control: public, max-age=86400`, ETag)
```ts
{ version: string, words: { en: string[]; hi: string[]; kn: string[]; ta: string[]; ... } }
```
Plain lexicon terms per language (native script + romanised). **No concept ids** — the cross-language map
stays on the server (SECURITY T17). Clients autocomplete within a language only.

### `GET /people` → people you've shared a moment with (D44)
```ts
{ people: { handle: string; avatar: string; stateCode: string | null;
            moments: number; lastAt: ISODate; last: "exact" | "bhasha" | "spot" }[] }   // newest first, ≤ 30
```
Partners on rounds where your words matched or you pinched the same spot. Handles only — never ids.

### `POST /packs/:packId/collect` → finalise (40/hour)
```ts
{
  earnedPaise: number, ledgerStatus: "credited" | "pending_review",
  xpGained: number, xpTotal: number,
  level: { value: number; nameKey: string; leveledUp: boolean; progress: [number, number] },
  flame: { value: number; increased: boolean; freezeUsed: boolean; freezes: number },
  newBadges: BadgeId[], newRegions: string[],
  pinches: number, bhasha: number, misses: number
}
```
Idempotent: a second call returns the same summary.

## Daily — Think Like India

### `GET /daily` → `{ day: "2026-10-13", number: 142, prompts: Round[5], answers: DailyAnswer[] }`
### `POST /daily/:day/answers` `{ idx: 0..4, word: { text, lang } }` (10/day)
→ `{ grade: "top" | "top5" | "none", india: { text: string, pct: number } }`
### `GET /daily/:day/share` → `{ text: "Same Pinch #142 🤏\n🟩🟩🟨⬜🟩  4/5\nsamepinch.vercel.app" }`

## Wallet

### `GET /wallet` → `{ balancePaise, pendingPaise, paidPaise, howPay: { basePaise: 50, bhashaPaise: 25, multiplier: 1.2 } }`
### `GET /wallet/ledger?cursor=&limit=30` → `{ items: LedgerItem[], nextCursor: string | null }`
### `GET /wallet/payouts` → `{ items: Payout[] }`
### `POST /wallet/payouts` `{ amountPaise: >= 5000, upi: string }` (3/day)
→ `201 { payout: { id, amountPaise, upiMasked: "v***@okaxis", status: "pending" } }`
Demo: becomes `paid` ~60 s later (lazy settle on next wallet read).

## Map & leaderboard

### `GET /map` → `{ synced: { stateCode, pinches, firstAt }[], total: 36 }`
### `GET /leaderboard?scope=city|state|india` (cached 60 s)
→ `{ weekStart, me: { rank, xp } | null, top: { rank, handle, avatar, level, xp }[] }` — never user IDs.

## Events

### `POST /events` `{ name: AllowedEvent, props?: object (≤ 1 KB) }` → `204` (120/hour)

## Jobs (server-to-server)

`POST /jobs/prune` — header `Authorization: Bearer $JOBS_SECRET`; called by a weekly GitHub Action.

---

## Client wrapper (web)

```ts
// frontend/src/lib/api.ts
const BASE = "/api/v1";
export async function api<T>(path: string, init: RequestInit & { schema: ZodType<T> }): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-SP-Client": "web", "X-SP-Device": deviceId(), ...init.headers },
  });
  if (res.status === 401) { await signInAnon(); return api(path, init); }   // one retry
  const body = res.status === 204 ? undefined : await res.json();
  if (!res.ok) throw new AppError(body?.error?.code ?? "INTERNAL", res.status);
  return init.schema.parse(body);
}
```
TanStack Query wraps these with `networkMode: "offlineFirst"`; round submissions go through the IndexedDB queue (ARCHITECTURE.md §4).
