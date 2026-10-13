// PostgreSQL schema (docs/DATA_MODEL.md, refined — see docs/DECISIONS.md).
// Rules: money in integer paise; timestamps are timestamptz (UTC); enums come from @shared so the DB,
// API and UI share one list; relations use join tables (not uuid[]) so foreign keys hold; derived
// values (level, gold accuracy, balance) are computed, never stored twice.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AVATARS,
  BADGE_IDS,
  DAILY_GRADES,
  EVENT_NAMES,
  IDENTITY_PROVIDERS,
  KYC_STATUSES,
  LANGS,
  LEDGER_KINDS,
  LEDGER_STATUSES,
  PAYOUT_STATUSES,
  PROMPT_KINDS,
  ROUND_RESULTS,
  THEMES,
  UI_LANGS,
  ZONES,
} from "@shared";

// ---------- Enums ----------
export const langEnum = pgEnum("lang", LANGS);
export const uiLangEnum = pgEnum("ui_lang", UI_LANGS);
export const avatarEnum = pgEnum("avatar", AVATARS);
export const promptKindEnum = pgEnum("prompt_kind", PROMPT_KINDS);
export const themeEnum = pgEnum("theme", THEMES);
export const roundResultEnum = pgEnum("round_result", ROUND_RESULTS);
export const ledgerKindEnum = pgEnum("ledger_kind", LEDGER_KINDS);
export const ledgerStatusEnum = pgEnum("ledger_status", LEDGER_STATUSES);
export const payoutStatusEnum = pgEnum("payout_status", PAYOUT_STATUSES);
export const dailyGradeEnum = pgEnum("daily_grade", DAILY_GRADES);
export const badgeIdEnum = pgEnum("badge_id", BADGE_IDS);
export const eventNameEnum = pgEnum("event_name", EVENT_NAMES);
export const regionKindEnum = pgEnum("region_kind", ["state", "ut"]);
export const zoneEnum = pgEnum("zone", ZONES);
export const candidateStatusEnum = pgEnum("candidate_status", ["new", "accepted", "rejected"]);
export const identityProviderEnum = pgEnum("identity_provider", IDENTITY_PROVIDERS);
export const kycStatusEnum = pgEnum("kyc_status", KYC_STATUSES);

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => tstz("created_at").notNull().defaultNow();

// =====================================================================
// Reference data
// =====================================================================

/** India's 28 states + 8 UTs. Seeded from @shared REGIONS. */
export const regions = pgTable(
  "regions",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    kind: regionKindEnum("kind").notNull(),
    zone: zoneEnum("zone").notNull(),
  },
  (t) => [check("regions_code_format", sql`${t.code} ~ '^[A-Z]{2}$'`)],
);

/** Tunable game numbers (docs/GAME_DESIGN.md) — changed without a deploy. */
export const gameConfig = pgTable("game_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: tstz("updated_at").notNull().defaultNow(),
});

export const badges = pgTable(
  "badges",
  {
    id: badgeIdEnum("id").primaryKey(),
    nameKey: text("name_key").notNull(),
    rule: jsonb("rule").notNull(),
    sort: smallint("sort").notNull(),
  },
  (t) => [unique("badges_sort_unique").on(t.sort)],
);

// =====================================================================
// Identity
// =====================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    avatar: avatarEnum("avatar").notNull().default("a1"),
    uiLang: uiLangEnum("ui_lang").notNull().default("en"),
    stateCode: text("state_code").references(() => regions.code), // self-declared, coarse
    city: text("city"), // self-declared, leaderboard scoping only
    tz: text("tz").notNull().default("Asia/Kolkata"),
    settings: jsonb("settings").notNull().default({}),
    xp: integer("xp").notNull().default(0),
    flame: integer("flame").notNull().default(0),
    flameBest: integer("flame_best").notNull().default(0),
    freezes: smallint("freezes").notNull().default(0),
    lastPlayDay: date("last_play_day"), // last local day a pack was collected
    lastRepairDay: date("last_repair_day"), // flame repair allowed once per 30 days
    goldStreak: integer("gold_streak").notNull().default(0), // consecutive correct gold prompts (Sharp Eye)
    restoreCodeHash: text("restore_code_hash"),
    deviceHash: text("device_hash"), // sha256(deviceId + pepper) of the first device
    isFlagged: boolean("is_flagged").notNull().default(false),
    isSeed: boolean("is_seed").notNull().default(false), // seeded partner accounts
    kycStatus: kycStatusEnum("kyc_status").notNull().default("none"), // stage 3: required for live payouts
    ageConfirmedAt: tstz("age_confirmed_at").notNull(),
    termsAcceptedAt: tstz("terms_accepted_at"), // null for accounts made before D45 and seeded players
    termsVersion: text("terms_version"),
    createdAt: createdAt(),
    updatedAt: tstz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("users_handle_unique").on(t.handle),
    uniqueIndex("users_restore_code_hash_unique").on(t.restoreCodeHash),
    index("users_device_hash_idx").on(t.deviceHash),
    index("users_state_city_idx").on(t.stateCode, t.city),
    check("users_handle_format", sql`${t.handle} ~ '^[a-z0-9_]{3,20}$'`),
    check("users_city_length", sql`${t.city} is null or char_length(${t.city}) between 1 and 60`),
    check("users_xp_nonneg", sql`${t.xp} >= 0`),
    check("users_flame_nonneg", sql`${t.flame} >= 0`),
    check("users_flame_best", sql`${t.flameBest} >= ${t.flame}`),
    check("users_freezes_range", sql`${t.freezes} between 0 and 2`),
    check("users_gold_streak_nonneg", sql`${t.goldStreak} >= 0`),
    check("users_settings_object", sql`jsonb_typeof(${t.settings}) = 'object'`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(), // sha256(cookie token + pepper); raw token never stored
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash"),
    createdAt: createdAt(),
    renewedAt: tstz("renewed_at").notNull().defaultNow(),
    expiresAt: tstz("expires_at").notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
    check("sessions_expiry_after_creation", sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);

/**
 * Optional verified identities linked to an (initially anonymous) account — stage 2 "secure your
 * account". Each is an extra recovery/sign-in route; progress stays on the same user row.
 * Subjects are stored as keyed hashes (Google ids never in clear); `display` is a masked email.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: identityProviderEnum("provider").notNull(),
    subjectHash: text("subject_hash").notNull(), // HMAC(google "sub")
    display: text("display").notNull(), // masked email, e.g. "v•••@gmail.com"
    verifiedAt: tstz("verified_at").notNull().defaultNow(),
    lastUsedAt: tstz("last_used_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }), // one Google account per player
    uniqueIndex("auth_identities_subject_unique").on(t.provider, t.subjectHash), // a Google account belongs to one player
  ],
);

// =====================================================================
// Content: concepts, lexicon, prompts
// =====================================================================

export const concepts = pgTable(
  "concepts",
  {
    id: text("id").primaryKey(), // e.g. c_dog
    gloss: text("gloss").notNull(),
  },
  (t) => [check("concepts_id_format", sql`${t.id} ~ '^c_[a-z0-9_]+$'`)],
);

/** Undirected "related" links (puppy ~ dog) for near pinches. Stored once with a < b. */
export const conceptEdges = pgTable(
  "concept_edges",
  {
    a: text("a")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    b: text("b")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.a, t.b] }), index("concept_edges_b_idx").on(t.b), check("concept_edges_ordered", sql`${t.a} < ${t.b}`)],
);

/** Normalised term → concept, per language. Romanised forms are their own rows (naayi, nayi). */
export const lexicon = pgTable(
  "lexicon",
  {
    term: text("term").notNull(),
    lang: langEnum("lang").notNull(),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.term, t.lang, t.conceptId] }),
    index("lexicon_term_idx").on(t.term),
    index("lexicon_concept_idx").on(t.conceptId),
    check("lexicon_term_length", sql`char_length(${t.term}) between 1 and 24`),
  ],
);

/** Words that never match ("thing", "nice", "ok"). */
export const lowInfoWords = pgTable("low_info_words", {
  term: text("term").primaryKey(),
});

export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: promptKindEnum("kind").notNull(),
    assetKey: text("asset_key"), // '3f9a' → /prompts/3f9a-{320,480,720}.webp or /prompts/3f9a.webm
    textKey: text("text_key").notNull(),
    textParams: jsonb("text_params"),
    theme: themeEnum("theme"),
    isGold: boolean("is_gold").notNull().default(false), // NEVER serialised (docs/SECURITY.md T2)
    goldConcepts: text("gold_concepts").array(), // NEVER serialised
    active: boolean("active").notNull().default(true),
    burntCheckedAt: tstz("burnt_checked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("prompts_active_idx").on(t.kind, t.isGold).where(sql`${t.active}`),
    uniqueIndex("prompts_asset_key_unique").on(t.assetKey),
    check("prompts_asset_matches_kind", sql`(${t.kind} = 'question') = (${t.assetKey} is null)`),
    check("prompts_asset_key_format", sql`${t.assetKey} is null or ${t.assetKey} ~ '^[a-z0-9-]{2,40}$'`),
    check(
      "prompts_gold_concepts",
      sql`(not ${t.isGold} and ${t.goldConcepts} is null)
       or (${t.isGold} and ${t.goldConcepts} is not null and cardinality(${t.goldConcepts}) between 1 and 4)`,
    ),
  ],
);

/** Concepts used by > 40% of recent answers for a prompt — no longer accepted (ESP "taboo words"). */
export const promptBurnt = pgTable(
  "prompt_burnt",
  {
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id, { onDelete: "cascade" }),
    conceptId: text("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    burntAt: tstz("burnt_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.promptId, t.conceptId] })],
);

// =====================================================================
// Play
// =====================================================================

/**
 * A pack of 5 rounds (D40; the idx check below still allows up to 10). Paid status is decided at collect time, not creation (docs/DECISIONS.md D5),
 * so prefetched offline packs never burn the daily paid cap.
 */
export const packs = pgTable(
  "packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    collectedAt: tstz("collected_at"),
    playedDay: date("played_day"), // local day the pack counts for (flame, caps)
    paid: boolean("paid"), // null until collected
    flagged: boolean("flagged").notNull().default(false), // anti-abuse: earnings held as pending_review
    summary: jsonb("summary"), // stored collect response → collect is idempotent
  },
  (t) => [
    index("packs_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("packs_user_uncollected_idx").on(t.userId).where(sql`${t.collectedAt} is null`),
    check(
      "packs_collect_consistent",
      sql`(${t.collectedAt} is null and ${t.summary} is null and ${t.paid} is null and ${t.playedDay} is null)
       or (${t.collectedAt} is not null and ${t.summary} is not null and ${t.paid} is not null and ${t.playedDay} is not null)`,
    ),
  ],
);

export const packRounds = pgTable(
  "pack_rounds",
  {
    packId: uuid("pack_id")
      .notNull()
      .references(() => packs.id, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id),
  },
  (t) => [
    primaryKey({ columns: [t.packId, t.idx] }),
    unique("pack_rounds_prompt_once").on(t.packId, t.promptId),
    check("pack_rounds_idx_range", sql`${t.idx} between 0 and 9`),
  ],
);

/**
 * One submitted round. This table is the dataset: rows outlive accounts (user_id → null, anonymised)
 * and become recorded partners for future players.
 */
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey(), // client attemptId → idempotency key
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    packId: uuid("pack_id").references(() => packs.id, { onDelete: "set null" }),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id),
    words: text("words").array().notNull(), // normalised
    langs: langEnum("langs").array().notNull(),
    conceptIds: text("concept_ids").array().notNull().default(sql`'{}'::text[]`),
    authorState: text("author_state").references(() => regions.code), // copied at submit for partner cards
    authorDeviceHash: text("author_device_hash"),
    authorGoldAcc: real("author_gold_acc"), // partner quality preference
    playedAt: tstz("played_at").notNull(),
    receivedAt: tstz("received_at").notNull().defaultNow(),
    responseMs: integer("response_ms"),
    partnerAnswerId: uuid("partner_answer_id"),
    result: roundResultEnum("result"), // null only for seeded partner answers
    goldCorrect: boolean("gold_correct"), // gold prompts only; NEVER serialised (docs/DECISIONS.md D22)
    matchConcepts: text("match_concepts").array().notNull().default(sql`'{}'::text[]`),
    xp: integer("xp").notNull().default(0),
    earnPaise: integer("earn_paise").notNull().default(0), // provisional; credited to the ledger at collect
    isSeed: boolean("is_seed").notNull().default(false),
    flagged: boolean("flagged").notNull().default(false),
    // Pinch the Picture (docs/DECISIONS.md D39): where on the photo, 0–1000 grid; null = no pinch.
    pinchX: smallint("pinch_x"),
    pinchY: smallint("pinch_y"),
    spotMatch: boolean("spot_match"), // null when either side didn't pinch
  },
  (t) => [
    foreignKey({ name: "answers_partner_fk", columns: [t.partnerAnswerId], foreignColumns: [t.id] }).onDelete("set null"),
    unique("answers_one_per_round").on(t.userId, t.packId, t.promptId),
    // Partner selection: recent, unflagged answers for a prompt.
    index("answers_partner_pool_idx")
      .on(t.promptId, t.receivedAt.desc())
      .where(sql`not ${t.flagged} and (cardinality(${t.words}) > 0 or ${t.pinchX} is not null)`),
    index("answers_user_received_idx").on(t.userId, t.receivedAt.desc()),
    index("answers_pack_idx").on(t.packId),
    // Gold accuracy over the last 30 days.
    index("answers_user_gold_idx")
      .on(t.userId, t.receivedAt)
      .where(sql`${t.goldCorrect} is not null`),
    check("answers_words_count", sql`cardinality(${t.words}) between 0 and 3`),
    check("answers_langs_match_words", sql`cardinality(${t.langs}) = cardinality(${t.words})`),
    check("answers_result_required", sql`${t.isSeed} or ${t.result} is not null`),
    check(
      "answers_skipped_iff_empty",
      sql`${t.result} is null or ((${t.result} = 'skipped') = (cardinality(${t.words}) = 0 and ${t.pinchX} is null))`,
    ),
    check(
      "answers_pinch_valid",
      sql`(${t.pinchX} is null and ${t.pinchY} is null)
       or (${t.pinchX} between 0 and 1000 and ${t.pinchY} between 0 and 1000)`,
    ),
    check("answers_seed_has_no_pack", sql`not ${t.isSeed} or ${t.packId} is null`),
    check("answers_xp_nonneg", sql`${t.xp} >= 0`),
    check("answers_earn_nonneg", sql`${t.earnPaise} >= 0`),
    check("answers_response_ms_nonneg", sql`${t.responseMs} is null or ${t.responseMs} >= 0`),
    check("answers_gold_acc_range", sql`${t.authorGoldAcc} is null or ${t.authorGoldAcc} between 0 and 1`),
    check("answers_not_own_partner", sql`${t.partnerAnswerId} is null or ${t.partnerAnswerId} <> ${t.id}`),
  ],
);

/** Per-user, per-local-day counters: paid-pack cap, ₹ daily cap, flame, weekly leaderboard. */
export const userDays = pgTable(
  "user_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    packs: smallint("packs").notNull().default(0),
    paidPacks: smallint("paid_packs").notNull().default(0),
    earnPaise: integer("earn_paise").notNull().default(0),
    xp: integer("xp").notNull().default(0),
    freezeUsed: boolean("freeze_used").notNull().default(false), // this day was covered by a freeze
    repaired: boolean("repaired").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day] }),
    index("user_days_day_idx").on(t.day),
    check("user_days_paid_le_packs", sql`${t.paidPacks} between 0 and ${t.packs}`),
    check("user_days_earn_nonneg", sql`${t.earnPaise} >= 0`),
    check("user_days_xp_nonneg", sql`${t.xp} >= 0`),
  ],
);

// =====================================================================
// Money — append-only ledger (amounts can never be edited or deleted; see migration guard trigger)
// =====================================================================

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    upiMasked: text("upi_masked").notNull(), // the full UPI ID is never stored in the demo
    status: payoutStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    settledAt: tstz("settled_at"),
  },
  (t) => [
    index("payouts_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("payouts_pending_idx").on(t.createdAt).where(sql`${t.status} = 'pending'`),
    check("payouts_min_amount", sql`${t.amountPaise} >= 5000`),
    check("payouts_settled_consistent", sql`(${t.status} = 'pending') = (${t.settledAt} is null)`),
  ],
);

export const ledger = pgTable(
  "ledger",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: ledgerKindEnum("kind").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(), // +earn, −payout
    status: ledgerStatusEnum("status").notNull(),
    packId: uuid("pack_id").references(() => packs.id, { onDelete: "set null" }),
    payoutId: uuid("payout_id").references(() => payouts.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("ledger_user_created_idx").on(t.userId, t.createdAt.desc(), t.id.desc()),
    // A pack is credited at most once; a payout is debited at most once.
    uniqueIndex("ledger_one_earn_per_pack").on(t.packId).where(sql`${t.kind} = 'earn'`),
    uniqueIndex("ledger_one_debit_per_payout").on(t.payoutId).where(sql`${t.kind} = 'payout'`),
    check(
      "ledger_sign_by_kind",
      sql`(${t.kind} = 'earn' and ${t.amountPaise} > 0)
       or (${t.kind} in ('payout', 'reversal') and ${t.amountPaise} < 0)
       or (${t.kind} = 'adjustment' and ${t.amountPaise} <> 0)`,
    ),
    check(
      "ledger_status_by_kind",
      sql`(${t.kind} = 'earn' and ${t.status} in ('credited', 'pending_review'))
       or (${t.kind} = 'payout' and ${t.status} in ('pending', 'paid', 'failed'))
       or (${t.kind} in ('reversal', 'adjustment') and ${t.status} = 'credited')`,
    ),
    check("ledger_reversal_has_note", sql`${t.kind} not in ('reversal', 'adjustment') or ${t.note} is not null`),
  ],
);

// =====================================================================
// Progress
// =====================================================================

export const userBadges = pgTable(
  "user_badges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: badgeIdEnum("badge_id")
      .notNull()
      .references(() => badges.id),
    earnedAt: tstz("earned_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.badgeId] })],
);

/** Sync Map: regions a user has pinched with. */
export const userRegions = pgTable(
  "user_regions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stateCode: text("state_code")
      .notNull()
      .references(() => regions.code),
    pinchCount: integer("pinch_count").notNull().default(1),
    firstAt: tstz("first_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stateCode] }), check("user_regions_count_positive", sql`${t.pinchCount} >= 1`)],
);

// =====================================================================
// Daily — Think Like India
// =====================================================================

export const dailySets = pgTable(
  "daily_sets",
  {
    day: date("day").primaryKey(), // IST date
    number: integer("number").notNull(), // "#142"
    createdAt: createdAt(),
  },
  (t) => [unique("daily_sets_number_unique").on(t.number), check("daily_sets_number_positive", sql`${t.number} > 0`)],
);

export const dailySetPrompts = pgTable(
  "daily_set_prompts",
  {
    day: date("day")
      .notNull()
      .references(() => dailySets.day, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(),
    promptId: uuid("prompt_id")
      .notNull()
      .references(() => prompts.id),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.idx] }),
    unique("daily_set_prompts_once").on(t.day, t.promptId),
    check("daily_set_prompts_idx_range", sql`${t.idx} between 0 and 4`),
  ],
);

export const dailyAnswers = pgTable(
  "daily_answers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    idx: smallint("idx").notNull(),
    word: text("word").notNull(), // normalised
    lang: langEnum("lang").notNull(),
    conceptId: text("concept_id").references(() => concepts.id, { onDelete: "set null" }),
    grade: dailyGradeEnum("grade").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day, t.idx] }),
    foreignKey({
      name: "daily_answers_prompt_fk",
      columns: [t.day, t.idx],
      foreignColumns: [dailySetPrompts.day, dailySetPrompts.idx],
    }).onDelete("cascade"),
    index("daily_answers_day_idx").on(t.day, t.idx),
    check("daily_answers_word_length", sql`char_length(${t.word}) between 1 and 24`),
  ],
);

// =====================================================================
// Ops
// =====================================================================

/** Fixed-window rate limiter (docs/BACKEND.md §7). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(), // user id or ip:…
    bucket: text("bucket").notNull(),
    windowStart: tstz("window_start").notNull(),
    count: integer("count").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.bucket, t.windowStart] }),
    index("rate_limits_window_idx").on(t.windowStart),
    check("rate_limits_count_positive", sql`${t.count} >= 1`),
  ],
);

/**
 * Pinch Notes (D48): a preset note from one player to their partner on a round, and at most one reply.
 * Notes reference the sender's answer; the recipient is that answer's partner's author.
 */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromUser: uuid("from_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUser: uuid("to_user")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answerId: uuid("answer_id").references(() => answers.id, { onDelete: "set null" }),
    replyTo: uuid("reply_to"),
    kind: text("kind").notNull(),
    createdAt: createdAt(),
    seenAt: tstz("seen_at"),
  },
  (t) => [
    foreignKey({ name: "notes_reply_fk", columns: [t.replyTo], foreignColumns: [t.id] }).onDelete("cascade"),
    index("notes_inbox_idx").on(t.toUser, t.createdAt.desc()),
    // One note per round, one reply per note.
    uniqueIndex("notes_one_per_answer").on(t.fromUser, t.answerId).where(sql`${t.replyTo} is null`),
    uniqueIndex("notes_one_reply").on(t.replyTo).where(sql`${t.replyTo} is not null`),
    check("notes_not_self", sql`${t.fromUser} <> ${t.toUser}`),
    check(
      "notes_kind",
      sql`${t.kind} in ('same_brain', 'haha_same', 'never_thought', 'hello', 'good_one', 'thanks')`,
    ),
  ],
);

/** First-party analytics only (no third-party trackers). Pruned after 90 days. */
export const events = pgTable(
  "events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: eventNameEnum("name").notNull(),
    props: jsonb("props"),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_created_idx").on(t.createdAt),
    index("events_name_created_idx").on(t.name, t.createdAt),
    check("events_props_size", sql`${t.props} is null or octet_length(${t.props}::text) <= 1024`),
  ],
);

/** Cross-language pairs players matched that the lexicon doesn't know yet — reviewed to grow the dictionary. */
export const lexiconCandidates = pgTable(
  "lexicon_candidates",
  {
    termA: text("term_a").notNull(),
    langA: langEnum("lang_a").notNull(),
    termB: text("term_b").notNull(),
    langB: langEnum("lang_b").notNull(),
    seen: integer("seen").notNull().default(1),
    status: candidateStatusEnum("status").notNull().default("new"),
    firstSeenAt: tstz("first_seen_at").notNull().defaultNow(),
    lastSeenAt: tstz("last_seen_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.termA, t.langA, t.termB, t.langB] }),
    index("lexicon_candidates_review_idx").on(t.status, t.seen.desc()),
    check("lexicon_candidates_canonical_order", sql`(${t.termA}, ${t.langA}::text) < (${t.termB}, ${t.langB}::text)`),
    check("lexicon_candidates_seen_positive", sql`${t.seen} >= 1`),
  ],
);

