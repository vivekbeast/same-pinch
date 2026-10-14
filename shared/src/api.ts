// The REST contract (docs/API.md) as zod schemas. The backend validates every input with these;
// the frontend parses every response with them. Responses never contain gold flags, user IDs of
// other players, or partner words before the player's own answer is stored (docs/SECURITY.md).
import { z } from "zod";
import {
  AVATARS,
  BADGE_IDS,
  DAILY_GRADES,
  ERROR_CODES,
  EVENT_NAMES,
  HANDLE_RE,
  IDENTITY_PROVIDERS,
  LANGS,
  LEADERBOARD_SCOPES,
  LEDGER_KINDS,
  LEDGER_STATUSES,
  LIMITS,
  NOTE_KINDS,
  PAYOUT_MODES,
  PAYOUT_STATUSES,
  PROMPT_KINDS,
  ROUND_RESULTS,
  RESTORE_CODE_RE,
  UI_LANGS,
  UPI_RE,
} from "./constants";
import { REGION_CODES } from "./regions";

// ---------- Primitives ----------
export const Lang = z.enum(LANGS);
export const UiLang = z.enum(UI_LANGS);
export const RegionCode = z.enum(REGION_CODES);
export const Paise = z.number().int();
export const IsoDate = z.iso.date(); // "2026-10-13"
export const IsoDateTime = z.iso.datetime({ offset: true });
export const Handle = z.string().regex(HANDLE_RE);
export const Avatar = z.enum(AVATARS);
export const BadgeId = z.enum(BADGE_IDS);

/** A word as typed by the player. Normalisation happens server-side with the same `normalize()`. */
export const WordInput = z.object({
  text: z.string().trim().min(1).max(64), // raw input; normalised to ≤ 24 chars
  lang: Lang,
});
export type WordInput = z.infer<typeof WordInput>;

/** A pinch on the photo: integer coordinates on a 0–1000 grid (docs/DECISIONS.md D39). */
export const PinchPoint = z.object({
  x: z.number().int().min(0).max(LIMITS.pinchGrid),
  y: z.number().int().min(0).max(LIMITS.pinchGrid),
});
export type PinchPoint = z.infer<typeof PinchPoint>;

// ---------- Errors ----------
export const ErrorCode = z.enum(Object.keys(ERROR_CODES) as [keyof typeof ERROR_CODES, ...(keyof typeof ERROR_CODES)[]]);
export const ErrorBody = z.object({ error: z.object({ code: ErrorCode, requestId: z.string().optional() }) });
export type ErrorBody = z.infer<typeof ErrorBody>;

// ---------- Health & config ----------
export const Health = z.object({ ok: z.boolean(), db: z.enum(["up", "down"]), version: z.string() });

export const GameConfigPublic = z.object({
  paidEnabled: z.boolean(),
  demoMode: z.boolean(),
  minPayoutPaise: Paise,
  paidPacksPerDay: z.number().int(),
  roundSeconds: z.object({ default: z.number().int(), sound: z.number().int() }),
  languages: z.array(UiLang),
  /** Which "secure your account" options this deployment offers (stage 2). */
  linking: z.object({ google: z.boolean() }),
  payoutMode: z.enum(PAYOUT_MODES),
});
export type GameConfigPublic = z.infer<typeof GameConfigPublic>;

// ---------- Auth & me ----------
/**
 * Sign-up (D45): language, 18+, Terms & Conditions, and a coarse location — state required, city optional.
 * Location powers language × region data (answers carry the author's state); never GPS, never an address.
 */
export const AnonInput = z.object({
  uiLang: UiLang,
  ageConfirmed: z.literal(true),
  termsAccepted: z.literal(true),
  stateCode: RegionCode,
  city: z.string().trim().min(1).max(40).optional(),
});
export const RestoreInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(RESTORE_CODE_RE),
});

export const Level = z.object({
  value: z.number().int().min(1).max(5),
  nameKey: z.string(),
  progress: z.tuple([z.number().int(), z.number().int()]), // [xp into level, xp needed for next]
});

export const Me = z.object({
  id: z.uuid(),
  handle: Handle,
  avatar: Avatar,
  uiLang: UiLang,
  stateCode: RegionCode.nullable(),
  city: z.string().nullable(),
  xp: z.number().int(),
  level: Level,
  flame: z.object({
    value: z.number().int(),
    best: z.number().int(),
    freezes: z.number().int().min(0).max(LIMITS.maxFreezes),
    safeToday: z.boolean(),
  }),
  paidPacksLeftToday: z.number().int(),
  balancePaise: Paise,
  pendingPaise: Paise,
  restoreCode: z.string().nullable(), // only on anon/restore responses (docs/DECISIONS.md D23)
  settings: z.record(z.string(), z.unknown()),
  /** Linked recovery routes, masked (e.g. "v•••@gmail.com"). */
  identities: z.array(z.object({ provider: z.enum(IDENTITY_PROVIDERS), display: z.string(), linkedAt: IsoDateTime })),
  /** Stage 3: can this player cash out, and if not, what's missing. */
  payout: z.object({ mode: z.enum(PAYOUT_MODES), eligible: z.boolean(), needs: z.array(z.enum(["identity", "kyc"])) }),
});
export type Me = z.infer<typeof Me>;
export const MeResponse = z.object({ user: Me });

// ---------- Securing the account (stage 2): Google, via the server-side OAuth redirect flow ----------
export const IdentityProviderParam = z.object({ provider: z.enum(IDENTITY_PROVIDERS) });

export const UserSettings = z
  .object({
    sound: z.boolean(),
    vibration: z.boolean(),
    dataSaver: z.boolean(),
    moreTime: z.boolean(),
    soundRounds: z.boolean(),
    reminderAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  })
  .partial();
export type UserSettings = z.infer<typeof UserSettings>;

export const PatchMeInput = z
  .object({
    handle: Handle,
    avatar: Avatar,
    uiLang: UiLang,
    stateCode: RegionCode.nullable(),
    city: z.string().trim().min(1).max(LIMITS.cityMax).nullable(),
    tz: z.string().min(1).max(64),
    settings: UserSettings,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "empty patch");

export const Badge = z.object({ id: BadgeId, nameKey: z.string(), sort: z.number().int() });
export const MeBadges = z.object({ earned: z.array(BadgeId), all: z.array(Badge) });

// ---------- Packs & rounds ----------
export const PromptAsset = z.object({ src: z.string(), srcset: z.string().optional() });

/** A round as the client sees it. Gold rounds are indistinguishable from normal ones. */
export const Round = z.object({
  promptId: z.uuid(),
  kind: z.enum(PROMPT_KINDS),
  asset: PromptAsset.nullable(),
  textKey: z.string(),
  textParams: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
  burnt: z.array(z.string()),
  seconds: z.number().int(),
});
export type Round = z.infer<typeof Round>;

export const Pack = z.object({
  packId: z.uuid(),
  // New packs have LIMITS.packSize (5) rounds; packs opened before D40 have 10 and stay playable.
  rounds: z.array(Round).min(1).max(LIMITS.maxPackRounds),
  answered: z.array(z.uuid()), // promptIds already submitted (resume an interrupted pack)
});
export type Pack = z.infer<typeof Pack>;

export const SubmitRoundInput = z.object({
  attemptId: z.uuid(),
  packId: z.uuid(),
  promptId: z.uuid(),
  words: z.array(WordInput).max(LIMITS.maxWords), // empty + no pinch = skipped (timer ran out)
  pinch: PinchPoint.nullable().optional(), // photo rounds only; words are optional once you've pinched
  playedAt: IsoDateTime,
  responseMs: z.number().int().min(0).max(10 * 60 * 1000),
});
export type SubmitRoundInput = z.infer<typeof SubmitRoundInput>;

export const RoundResultResponse = z.object({
  result: z.enum(ROUND_RESULTS),
  you: z.array(z.object({ text: z.string(), lang: Lang, matched: z.boolean(), burnt: z.boolean() })),
  partner: z
    .object({
      handle: z.string(),
      avatar: Avatar,
      stateCode: RegionCode.nullable(),
      words: z.array(z.object({ text: z.string(), lang: Lang, matched: z.boolean() })),
      /** Pinches you'd already shared with this person before this round (rematch). */
      together: z.number().int().min(0).optional(),
    })
    .nullable(), // null only for skipped rounds
  xp: z.number().int(),
  /** Hot hand bonus applied to this round's XP (HOT_HAND). */
  hot: z.boolean().optional(),
  earnPaise: Paise, // provisional until the pack is collected (docs/DECISIONS.md D5)
  newRegion: RegionCode.nullable(),
  /** Pinch the Picture: where you both pinched. `partner` is null when they didn't pinch. */
  spot: z
    .object({
      you: PinchPoint,
      partner: PinchPoint.nullable(),
      same: z.boolean(),
      /**
       * Everyone else's pinches on this photo, binned: `cells` are [x, y, count] at cell centres on the
       * 0–1000 grid; `near` is the % of them within the same-spot radius of yours. Sent only after your
       * answer is stored, and only once enough people have pinched.
       */
      crowd: z
        .object({
          n: z.number().int().min(1),
          near: z.number().int().min(0).max(100),
          cells: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int().min(1)])).max(80),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});
export type RoundResultResponse = z.infer<typeof RoundResultResponse>;

export const CollectResponse = z.object({
  earnedPaise: Paise,
  paid: z.boolean(), // false when the daily paid cap was already reached → XP only
  ledgerStatus: z.enum(["credited", "pending_review"]).nullable(),
  xpGained: z.number().int(),
  xpTotal: z.number().int(),
  level: Level.extend({ leveledUp: z.boolean() }),
  flame: z.object({
    value: z.number().int(),
    increased: z.boolean(),
    freezeUsed: z.boolean(),
    freezes: z.number().int(),
  }),
  newBadges: z.array(BadgeId),
  newRegions: z.array(RegionCode),
  pinches: z.number().int(),
  bhasha: z.number().int(),
  misses: z.number().int(),
});
export type CollectResponse = z.infer<typeof CollectResponse>;

// ---------- Daily ----------
export const DailyAnswer = z.object({
  idx: z.number().int().min(0).max(LIMITS.dailySize - 1),
  word: z.string(),
  lang: Lang,
  grade: z.enum(DAILY_GRADES),
  india: z.object({ text: z.string(), pct: z.number() }).nullable(),
});
export const Daily = z.object({
  day: IsoDate,
  number: z.number().int(),
  prompts: z.array(Round).length(LIMITS.dailySize),
  answers: z.array(DailyAnswer),
});
export const DailyAnswerInput = z.object({
  idx: z.number().int().min(0).max(LIMITS.dailySize - 1),
  word: WordInput,
});
export const DailyShare = z.object({ text: z.string() });
export const DailyAnswerResult = z.object({
  grade: z.enum(DAILY_GRADES),
  india: z.object({ text: z.string(), pct: z.number() }).nullable(),
  xp: z.number().int(),
  newBadges: z.array(BadgeId),
});

// ---------- Wallet ----------
export const Wallet = z.object({
  balancePaise: Paise,
  pendingPaise: Paise,
  paidPaise: Paise,
  howPay: z.object({ basePaise: Paise, bhashaPaise: Paise, multiplier: z.number() }),
});
export const LedgerItem = z.object({
  id: z.number().int(),
  kind: z.enum(LEDGER_KINDS),
  amountPaise: Paise,
  status: z.enum(LEDGER_STATUSES),
  note: z.string().nullable(),
  pinches: z.number().int().nullable(),
  createdAt: IsoDateTime,
});
export const LedgerPage = z.object({ items: z.array(LedgerItem), nextCursor: z.string().nullable() });
export const Payout = z.object({
  id: z.uuid(),
  amountPaise: Paise,
  upiMasked: z.string(),
  status: z.enum(PAYOUT_STATUSES),
  createdAt: IsoDateTime,
  settledAt: IsoDateTime.nullable(),
});
export const PayoutList = z.object({ items: z.array(Payout) });
export const PayoutCreated = z.object({ payout: Payout });
export const PayoutInput = z.object({
  amountPaise: z.number().int().positive().max(10_000_000), // < ₹50 → MIN_PAYOUT from the service (docs/SECURITY.md §8)
  upi: z.string().trim().regex(UPI_RE),
});

// ---------- Map & leaderboard ----------
export const MapResponse = z.object({
  synced: z.array(z.object({ stateCode: RegionCode, pinches: z.number().int(), firstAt: IsoDateTime })),
  total: z.literal(36),
});
export const LeaderboardQuery = z.object({ scope: z.enum(LEADERBOARD_SCOPES).default("india") });
export const Leaderboard = z.object({
  weekStart: IsoDate,
  me: z.object({ rank: z.number().int(), xp: z.number().int() }).nullable(),
  top: z.array(
    z.object({ rank: z.number().int(), handle: z.string(), avatar: Avatar, level: z.number().int(), xp: z.number().int() }),
  ),
});

// ---------- People: who you've shared a moment with (D44) ----------
export const MOMENT_KINDS = ["exact", "bhasha", "spot"] as const;
export const PeopleResponse = z.object({
  people: z.array(
    z.object({
      handle: z.string(),
      avatar: Avatar,
      stateCode: RegionCode.nullable(),
      moments: z.number().int(), // rounds where your words or your pinch met theirs
      lastAt: IsoDateTime,
      last: z.enum(MOMENT_KINDS),
    }),
  ),
});
export type PeopleResponse = z.infer<typeof PeopleResponse>;

// ---------- Pinch Notes (D48) ----------
export const NoteKind = z.enum(NOTE_KINDS);
/** Send a note to the partner of one of your rounds (identified by your attemptId). */
export const SendNoteInput = z.object({ attemptId: z.uuid(), kind: NoteKind });
export const ReplyNoteInput = z.object({ kind: NoteKind });
export const NoteParams = z.object({ noteId: z.uuid() });
export const Note = z.object({
  id: z.uuid(), // the note's own id (never a user id)
  from: z.object({ handle: z.string(), avatar: Avatar, stateCode: RegionCode.nullable() }),
  kind: NoteKind,
  at: IsoDateTime,
  seen: z.boolean(),
  isReply: z.boolean(),
  canReply: z.boolean(),
});
export const NotesResponse = z.object({ notes: z.array(Note), unread: z.number().int() });
export type NotesResponse = z.infer<typeof NotesResponse>;
export const NoteSent = z.object({ ok: z.literal(true) });

// ---------- Events ----------
export const EventInput = z.object({
  name: z.enum(EVENT_NAMES),
  props: z
    .record(z.string(), z.unknown())
    .optional()
    .refine((p) => !p || JSON.stringify(p).length <= LIMITS.eventPropsMaxBytes, "props too large"),
});

// ---------- Smart Chips ----------
/**
 * Typing suggestions: plain per-language word lists (native script + romanised). Deliberately no concept
 * ids, so the cross-language map never leaves the server (docs/SECURITY.md T17).
 */
export const WordList = z.object({
  version: z.string(),
  words: z.partialRecord(Lang, z.array(z.string())),
});
export type WordList = z.infer<typeof WordList>;
