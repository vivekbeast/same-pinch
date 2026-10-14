// Single source for every enum-like list. The backend builds its Postgres enums from these
// arrays, so the database, the API contract and the UI can never disagree.

/** Languages a word can be in (Bhasha Plate strips). */
export const LANGS = ["en", "hi", "kn", "ta", "te", "mr"] as const;
export type Lang = (typeof LANGS)[number];

/** Languages the UI is translated into at launch. */
export const UI_LANGS = ["en", "hi", "kn", "ta"] as const;
export type UiLang = (typeof UI_LANGS)[number];

export const PROMPT_KINDS = ["image", "sound", "vibe", "question"] as const;
export type PromptKind = (typeof PROMPT_KINDS)[number];

/** Daily themes (docs/CONTENT_I18N.md §6). Mon → Sun. */
export const THEMES = ["food", "weather", "city_sounds", "festivals", "college", "travel", "feelings"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Outcome of a submitted round, always scored against the partner. Gold (hidden test) rounds are scored
 * and paid the same way so they stay indistinguishable; their verdict lives in answers.gold_correct,
 * which is never serialised (docs/DECISIONS.md D22).
 */
export const ROUND_RESULTS = ["exact", "bhasha", "near", "miss", "skipped"] as const;
export type RoundResult = (typeof ROUND_RESULTS)[number];
export const PINCH_RESULTS: readonly RoundResult[] = ["exact", "bhasha"];

/** Prompt kinds played as Pinch the Picture: pinch a spot first, naming it is optional (D39). */
export const PINCH_KINDS: readonly PromptKind[] = ["image"];

export const LEDGER_KINDS = ["earn", "payout", "reversal", "adjustment"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

/**
 * credited       — earned, counts toward balance
 * pending_review — earned but held (flagged pack); does not count yet
 * pending        — payout requested, money reserved
 * paid           — payout settled
 * failed         — payout failed; money returns to balance
 */
export const LEDGER_STATUSES = ["credited", "pending_review", "pending", "paid", "failed"] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const PAYOUT_STATUSES = ["pending", "paid", "failed"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const DAILY_GRADES = ["top", "top5", "none"] as const;
export type DailyGrade = (typeof DAILY_GRADES)[number];

/** Optional ways to secure an anonymous account (stage 2). The restore code always works too. */
export const IDENTITY_PROVIDERS = ["google"] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

/** Payout pipeline (stage 3): simulated in the demo; live needs KYC + a payout partner (not built). */
export const PAYOUT_MODES = ["simulated", "disabled", "live"] as const;
export type PayoutMode = (typeof PAYOUT_MODES)[number];
export const KYC_STATUSES = ["none", "pending", "verified", "rejected"] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const LEADERBOARD_SCOPES = ["city", "state", "india"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];

export const AVATARS = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12"] as const;
export type Avatar = (typeof AVATARS)[number];

/**
 * Pinch Notes (D48): preset, translated notes players send each other after a round. No free text —
 * strangers + money + 18+ means no room for harassment, phone numbers or scams.
 */
export const NOTE_KINDS = ["same_brain", "haha_same", "never_thought", "hello", "good_one", "thanks"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const BADGE_IDS = [
  "first_pinch",
  "bhasha_bridge",
  "double_pinch",
  "fire_starter",
  "week_of_flames",
  "burnt_hunter",
  "sound_mind",
  "vibe_twin",
  "explorer",
  "bharat_synced",
  "india_brain",
  "sharp_eye",
  "brain_twin",
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];

export const EVENT_NAMES = [
  "app_open",
  "pack_start",
  "round_drop",
  "pack_collect",
  "daily_done",
  "share",
  "install_accept",
  "payout_request",
  "vitals",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const ERROR_CODES = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 422,
  DAILY_CAP: 409,
  STALE_ROUND: 409,
  MIN_PAYOUT: 409,
  INSUFFICIENT_BALANCE: 409,
  ALREADY_ANSWERED: 409,
  PACK_INCOMPLETE: 409,
  HANDLE_TAKEN: 409,
  IDENTITY_TAKEN: 409,
  VERIFICATION_REQUIRED: 409,
  PROVIDER_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  PAID_PAUSED: 503,
  INTERNAL: 500,
} as const;
export type ErrorCode = keyof typeof ERROR_CODES;

/** Hard limits shared by UI validation and the server. */
/** Current Terms & Conditions version. Bump when the terms change; sign-ups record what they accepted (D45). */
export const TERMS_VERSION = "2026-10-14";

export const LIMITS = {
  maxWords: 3,
  /** Pinch coordinates are integers on a 0–1000 grid over the (square) photo. */
  pinchGrid: 1000,
  maxWordLength: 24,
  packSize: 5, // short packs keep it fun (docs/DECISIONS.md D40)
  /** Older open packs (pre-D40) were 10 rounds; the contract accepts them until they're collected. */
  maxPackRounds: 10,
  dailySize: 5,
  minPayoutPaise: 5_000,
  maxFreezes: 2,
  handleMin: 3,
  handleMax: 20,
  cityMax: 60,
  eventPropsMaxBytes: 1_024,
  playedAtMaxAgeMs: 48 * 60 * 60 * 1000,
  playedAtMaxFutureMs: 5 * 60 * 1000,
  restoreCodeLength: 8,
} as const;

/**
 * Hot hand (inside one pack): after `after` pinches in a row, the next round's timer is cut to
 * `timeShare` of normal and its XP is multiplied by `xpMult` if answered in that time (+ `graceMs`, so an
 * answer dropped by the timer itself still counts). XP only — never ₹ (docs/GAME_DESIGN.md §0). Shared
 * because the client shortens the timer and the server grants the XP.
 */
export const HOT_HAND = { after: 3, timeShare: 0.5, xpMult: 2, graceMs: 1_000 } as const;

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
/** Indian mobile: optional +91 / 0, then 10 digits starting 6–9. Spaces and dashes are ignored. */
/** UPI VPA, e.g. name.123@okaxis (docs/SCREENS.md §10). */
export const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
/** Crockford base32 without 0/O/1/I (docs/BACKEND.md §4). */
export const RESTORE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const RESTORE_CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

/** XP levels (docs/GAME_DESIGN.md §8). */
export const LEVELS = [
  { value: 1, nameKey: "level.stranger", xp: 0 },
  { value: 2, nameKey: "level.same_wave", xp: 150 },
  { value: 3, nameKey: "level.mind_reader", xp: 500 },
  { value: 4, nameKey: "level.telepath", xp: 1_500 },
  { value: 5, nameKey: "level.pinch_oracle", xp: 4_000 },
] as const;
