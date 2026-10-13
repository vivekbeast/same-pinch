# DATA_MODEL.md — PostgreSQL schema (Drizzle ORM)

> **Source of truth:** `backend/src/db/schema.ts` and the SQL in `backend/drizzle/`. This document is the original design; the refinements made while building it are listed in `docs/DECISIONS.md` D16–D21.

Principles
- Postgres is the single source of truth: users, sessions, game data, money, rate limits.
- Only the Express API talks to the database. Authorization happens in services (`where userId = req.user.id` on every user-scoped query) — enforced by a repository helper and tests (SECURITY.md §8).
- Money in **paise** (`bigint`), never floats. Ledger is append-only.
- Timestamps `timestamptz` (UTC); day boundaries computed in the user's timezone.
- Schema is written in Drizzle (`backend/src/db/schema.ts`); `drizzle-kit generate` produces the SQL migrations that are committed and reviewed.

## 1. Tables (SQL view of the schema)

```sql
create extension if not exists pgcrypto;

-- ---------- Identity ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  avatar text not null default 'a1',
  ui_lang text not null default 'en' check (ui_lang in ('en','hi','kn','ta','te','mr')),
  state_code text,                       -- self-declared, coarse
  city text,                             -- self-declared, leaderboard scoping only
  tz text not null default 'Asia/Kolkata',
  settings jsonb not null default '{}',  -- sound, vibration, dataSaver, moreTime, reminderAt
  xp int not null default 0,
  level smallint not null default 1,
  flame int not null default 0,
  flame_best int not null default 0,
  freezes smallint not null default 0 check (freezes between 0 and 2),
  last_play_day date,
  gold_correct int not null default 0,
  gold_total int not null default 0,
  restore_code_hash text unique,         -- sha256 of current restore code
  device_hash text,                      -- sha256(deviceId + pepper) of first device
  is_flagged boolean not null default false,
  age_confirmed_at timestamptz not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table sessions (
  token_hash text primary key,           -- sha256(cookie token)
  user_id uuid not null references users on delete cascade,
  device_hash text,
  created_at timestamptz not null default now(),
  renewed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on sessions (user_id);

-- ---------- Content ----------
create table concepts (id text primary key, gloss text not null);
create table concept_edges (a text references concepts, b text references concepts, primary key (a, b));
create table lexicon (
  term text not null, lang text not null, concept_id text not null references concepts,
  primary key (term, lang, concept_id)
);
create index on lexicon (term);
create table low_info_words (term text primary key);

create table prompts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image','sound','vibe','question')),
  asset_key text,                        -- e.g. '3f9a' → /prompts/3f9a-{320,480,720}.webp
  text_key text not null,
  text_params jsonb,
  is_gold boolean not null default false,
  gold_concepts text[],
  theme text,
  active boolean not null default true,
  burnt_checked_at timestamptz,
  created_at timestamptz not null default now()
);
create table prompt_burnt (
  prompt_id uuid references prompts on delete cascade,
  concept_id text references concepts,
  burnt_at timestamptz not null default now(),
  primary key (prompt_id, concept_id)
);

-- ---------- Play ----------
create table packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  prompt_ids uuid[] not null check (array_length(prompt_ids, 1) = 10),
  is_paid boolean not null default true,
  created_at timestamptz not null default now(),
  collected_at timestamptz,
  summary jsonb                           -- stored collect response (idempotency)
);
create index on packs (user_id, created_at desc);

create table answers (
  id uuid primary key,                    -- client attemptId (idempotency key)
  user_id uuid references users on delete set null,   -- null after account deletion (anonymised)
  pack_id uuid references packs on delete set null,
  prompt_id uuid not null references prompts,
  words text[] not null check (array_length(words, 1) between 1 and 3),
  langs text[] not null,
  concept_ids text[] not null default '{}',
  author_state text,                      -- copied at submit time for partner display
  author_device_hash text,
  author_gold_acc real,
  played_at timestamptz not null,
  received_at timestamptz not null default now(),
  response_ms int,
  partner_answer_id uuid references answers,
  result text check (result in ('exact','bhasha','near','miss','skipped','gold_ok','gold_miss')),
  match_concepts text[] not null default '{}',
  xp int not null default 0,
  earn_paise int not null default 0,
  is_seed boolean not null default false,
  flagged boolean not null default false,
  unique (user_id, pack_id, prompt_id)
);
create index on answers (prompt_id, received_at desc);
create index on answers (user_id, received_at desc);

-- ---------- Money (append-only) ----------
create table ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references users on delete cascade,
  kind text not null check (kind in ('earn','payout','reversal','adjustment')),
  amount_paise bigint not null,           -- +earn, −payout
  status text not null check (status in ('credited','pending_review','pending','paid','failed')),
  pack_id uuid references packs,
  payout_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on ledger (user_id, created_at desc);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users on delete cascade,
  amount_paise bigint not null check (amount_paise >= 5000),
  upi_masked text not null,               -- demo stores masked only
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

-- ---------- Progress ----------
create table badges (id text primary key, name_key text not null, rule jsonb not null, sort smallint not null);
create table user_badges (
  user_id uuid references users on delete cascade, badge_id text references badges,
  earned_at timestamptz not null default now(), primary key (user_id, badge_id)
);
create table user_regions (
  user_id uuid references users on delete cascade, state_code text not null,
  pinch_count int not null default 1, first_at timestamptz not null default now(),
  primary key (user_id, state_code)
);

-- ---------- Daily ----------
create table daily_sets (day date primary key, number int not null, prompt_ids uuid[] not null check (array_length(prompt_ids, 1) = 5));
create table daily_answers (
  user_id uuid references users on delete cascade, day date references daily_sets,
  idx smallint check (idx between 0 and 4), word text not null, lang text not null,
  concept_id text, grade text check (grade in ('top','top5','none')),
  primary key (user_id, day, idx)
);

-- ---------- Ops ----------
create table rate_limits (
  key text not null, bucket text not null, window_start timestamptz not null, count int not null,
  primary key (key, bucket, window_start)
);
create table events (id bigint generated always as identity primary key, user_id uuid, name text not null, props jsonb, created_at timestamptz default now());
create table lexicon_candidates (term_a text, lang_a text, term_b text, lang_b text, seen int not null default 1, primary key (term_a, lang_a, term_b, lang_b));
create table game_config (key text primary key, value jsonb not null);
```

Drizzle excerpt:

```ts
// backend/src/db/schema.ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull().unique(),
  uiLang: text("ui_lang").notNull().default("en"),
  xp: integer("xp").notNull().default(0),
  flame: integer("flame").notNull().default(0),
  freezes: smallint("freezes").notNull().default(0),
  lastPlayDay: date("last_play_day"),
  // …
});
export const answers = pgTable("answers", {
  id: uuid("id").primaryKey(),                 // attemptId
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  promptId: uuid("prompt_id").notNull().references(() => prompts.id),
  words: text("words").array().notNull(),
  earnPaise: integer("earn_paise").notNull().default(0),
  // …
}, (t) => [uniqueIndex().on(t.userId, t.packId, t.promptId), index().on(t.promptId, t.receivedAt)]);
```

## 2. Access rules (enforced in code + tests)

| Data | Who can read | Who can write |
|---|---|---|
| `users` | the user (via `/me`); others see only `handle, avatar, level, xp, state` in leaderboard/partner payloads | services only |
| `sessions` | never exposed | auth service |
| `answers` | the author (their own history); **other users' words only after they submit the same prompt**, inside the reveal payload | scoring service |
| `prompts.is_gold`, `gold_concepts` | **never** serialised — DTO mappers whitelist fields | admin seed only |
| `ledger`, `payouts` | the owner | economy/payout services |
| `lexicon`, `concepts` | never sent wholesale (prevents answer-lookup bots) | seed/admin |

Repository helper makes the user filter impossible to forget:

```ts
export const mine = <T extends { userId: AnyColumn }>(table: T, userId: string) => eq(table.userId, userId);
// db.select().from(ledger).where(and(mine(ledger, req.user.id), …))
```

**Database roles:** the API connects as `app_user` with `SELECT/INSERT/UPDATE` on app tables, `DELETE` only where needed (sessions, rate_limits, events), no DDL. Migrations run as the owner role from CI only.

## 3. Seed data (`backend/src/db/seed/`)

- 120 prompts (60 image, 20 sound, 20 vibe, 20 question), 15 gold.
- ~600 concepts, ~2,500 lexicon rows (en/hi/kn + partial ta), including romanised forms.
- 5 seeded partner answers per prompt from 30 seed users across many states (so the Sync Map fills during a demo).
- Pre-burnt words on 10 prompts.
- Demo accounts with history (flame 7, level 3, ₹62.40), reachable via `/welcome?demo=1` when `DEMO_MODE=true`.

## 4. Retention & deletion

- `answers` are the dataset. On account deletion: `users` row deleted, `answers.user_id` set null (anonymised), sessions/ledger/payouts/badges cascade-deleted.
- `events` pruned after 90 days (weekly job). `rate_limits` rows older than 2 days pruned in the same job. Expired `sessions` deleted on read and by the job.
