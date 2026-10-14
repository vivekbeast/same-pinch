// Typed game configuration (docs/GAME_DESIGN.md). Defaults live here; the `game_config` table can
// override any top-level key at runtime without a deploy.
import { LEVELS } from "@shared";

export const DEFAULT_CONFIG = {
  paid_enabled: true as boolean,
  pay: { basePaise: 50, bhashaBonusPaise: 25, minMultiplier: 0.5, maxMultiplier: 1.5, newUserGoldAcc: 0.8, minGoldSamples: 3, dailyCapPaise: 4_000 },
  packs: { paidPerDay: 5, normalRounds: 3, goldRounds: 1, vibeRounds: 1, keepOffline: 2, maxOpen: 3, perHour: 30 }, // 5 rounds (D40); perHour counts created packs only (D44)
  xp: { exact: 10, bhasha: 15, near: 4, miss: 1, extraMatch: 2, packBonus: 20, dailyTop: 5, dailyTop5: 2 },
  round: { seconds: 20, soundSeconds: 25 },
  // minAnswers: don't burn on tiny samples (5 seeded answers would otherwise burn everything at once).
  burn: { windowAnswers: 50, threshold: 0.4, minAnswers: 20, recheckMinutes: 15 },
  flame: { freezeEveryDays: 7, maxFreezes: 2, repairPacks: 2, repairCooldownDays: 30 },
  abuse: { fastResponseMs: 800, fastRoundsToFlag: 3, sameAnswerShare: 0.6 },
  // mode: "simulated" (demo ledger only) | "disabled" | "live" (needs KYC + a payout partner — not built).
  payout: { mode: "simulated" as "simulated" | "disabled" | "live", minPaise: 5_000, perDay: 3, demoSettleSeconds: 60 },
  // rematchChance: how often a partner you've pinched with before is preferred, when one is in the pool.
  partner: { recentPool: 20, preferGoldAcc: 0.75, rematchChance: 0.35 },
  // Pinch the Picture (D39): same spot = within `sameSpot` on the 0–1000 grid. A same spot earns XP, never ₹:
  // tapping can match by chance, so money stays tied to words matched by meaning.
  pinch: { sameSpot: 170, spotXp: 6 },
  // Crowd heatmap on the reveal: the last `window` pinches on a photo, binned into `cell`-sized squares; the
  // busiest `maxCells` are sent. Hidden until `minAnswers` other people have pinched.
  crowd: { window: 500, cell: 50, maxCells: 60, minAnswers: 5 },
  daily: { launchDay: "2026-05-25", size: 5, minAnswers: 3 },
  levels: LEVELS as unknown as { value: number; nameKey: string; xp: number }[],
};

export type GameConfig = typeof DEFAULT_CONFIG;
