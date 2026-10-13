# API.md — REST contract (Express)

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
| `POST /auth/anon` | `{ uiLang, ageConfirmed: true }` | `201 { user: Me }` + `Set-Cookie: sp_sid=…` | 20/hour/IP |
| `POST /auth/restore` | `{ code: "8 chars" }` | `200 { user: Me }` + new cookie; code rotates | 5/hour/IP |
| `POST /auth/logout` | — | `204`, cookie cleared | — |
| `POST /auth/logout-all` | — | `204` | 5/day |

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

### `POST /packs` → create/get the next pack (10/hour)
```json
{
  "packId": "uuid", "isPaid": true,
  "rounds": [
    { "promptId": "uuid", "kind": "image", "asset": { "src": "/prompts/3f9a….webp", "srcset": "/prompts/3f9a-320.webp 320w, …" },
      "textKey": "prompt.what_do_you_see", "burnt": ["dog", "animal"], "seconds": 20 }
  ]
}
```
Gold prompts look exactly like normal rounds. Partner answers are **never** included.

### `POST /rounds` → submit one round (60/min)
```ts
// request
{ attemptId: uuid, packId: uuid, promptId: uuid,
  words: { text: string, lang: Lang }[1..3], playedAt: ISODate, responseMs: number }

// response
{
  result: "exact" | "bhasha" | "near" | "miss" | "skipped",
  you:     { text: string; lang: Lang; matched: boolean; burnt: boolean }[],
  partner: { handle: string; avatar: string; stateCode: string;
             words: { text: string; lang: Lang; matched: boolean }[] },
  xp: number,
  earnPaise: number,        // provisional until the pack is collected
  newRegion?: string
}
```
- **Idempotent** on `attemptId`: resending returns the same result, never double-pays.
- `playedAt` must be within the last 48 h and not more than 5 min in the future.

### `POST /packs/:packId/collect` → finalise (20/hour)
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
