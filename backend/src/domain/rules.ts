// Pure game rules (docs/GAME_DESIGN.md). No I/O here — everything is unit-tested in rules.test.ts.
import type { DailyGrade, RoundResult } from "@shared";
import { addDays, daysBetween } from "../lib/time.js";
import type { GameConfig } from "./config.js";

// ---------- Levels ----------
export function levelFor(xp: number, levels: GameConfig["levels"]) {
  let i = 0;
  while (i + 1 < levels.length && xp >= levels[i + 1]!.xp) i++;
  const cur = levels[i]!;
  const next = levels[i + 1];
  return {
    value: cur.value,
    nameKey: cur.nameKey,
    // [xp into this level, xp this level spans]; at max level the bar is simply full.
    progress: (next ? [xp - cur.xp, next.xp - cur.xp] : [xp - cur.xp, xp - cur.xp]) as [number, number],
  };
}

// ---------- Pay ----------
/** Gold accuracy over the recent window; new players get the benefit of the doubt (0.8). */
export function goldAccuracy(correct: number, total: number, pay: GameConfig["pay"]) {
  return total < pay.minGoldSamples ? pay.newUserGoldAcc : correct / total;
}

/** Work-quality multiplier: clamp(0.5, 1.5, 0.5 + accuracy). */
export function qualityMultiplier(accuracy: number, pay: GameConfig["pay"]) {
  const m = Math.min(pay.maxMultiplier, Math.max(pay.minMultiplier, 0.5 + accuracy));
  return Math.round(m * 100) / 100;
}

/** ₹ for one round. Only verified pinches pay; near pinches and misses are not labels (₹0). */
export function roundEarnPaise(result: RoundResult, multiplier: number, pay: GameConfig["pay"]) {
  if (result !== "exact" && result !== "bhasha") return 0;
  return Math.round((pay.basePaise + (result === "bhasha" ? pay.bhashaBonusPaise : 0)) * multiplier);
}

/** XP for a round: the word result, plus the same-spot bonus on Pinch the Picture rounds (D39). */
export function roundXpWithSpot(result: RoundResult, matches: number, sameSpot: boolean, cfg: Pick<GameConfig, "xp" | "pinch">) {
  return roundXp(result, matches, cfg.xp) + (sameSpot ? cfg.pinch.spotXp : 0);
}

export function roundXp(result: RoundResult, matches: number, xp: GameConfig["xp"]) {
  switch (result) {
    case "exact":
      return xp.exact + Math.max(0, matches - 1) * xp.extraMatch;
    case "bhasha":
      return xp.bhasha + Math.max(0, matches - 1) * xp.extraMatch;
    case "near":
      return xp.near;
    case "miss":
      return xp.miss;
    case "skipped":
      return 0;
  }
}

// ---------- Flame (streak) ----------
export interface FlameState {
  flame: number;
  best: number;
  freezes: number;
  lastPlayDay: string | null;
}

export interface FlameStep extends FlameState {
  increased: boolean;
  /** Missed days that a freeze covered (recorded as user_days.freeze_used). */
  frozenDays: string[];
  /** The streak broke (no freezes left to cover the gap). */
  broke: boolean;
}

/**
 * Apply "a pack was completed on `day`". A day counts once; missed days are covered by freezes if
 * enough are held (all-or-nothing), otherwise the flame restarts at 1. A freeze is earned every
 * 7 flame days, max 2. Packs from an earlier day than the last played one don't move the flame.
 */
export function nextFlame(s: FlameState, day: string, cfg: GameConfig["flame"]): FlameStep {
  const same = { ...s, increased: false, frozenDays: [], broke: false };
  if (s.lastPlayDay && daysBetween(s.lastPlayDay, day) <= 0) return same;

  let { flame, freezes } = s;
  let frozenDays: string[] = [];
  let broke = false;

  if (!s.lastPlayDay) flame = 1;
  else {
    const missed = daysBetween(s.lastPlayDay, day) - 1;
    if (missed === 0) flame += 1;
    else if (freezes >= missed) {
      freezes -= missed;
      frozenDays = Array.from({ length: missed }, (_, i) => addDays(s.lastPlayDay!, i + 1));
      flame += 1;
    } else {
      flame = 1;
      broke = true;
    }
  }
  if (flame % cfg.freezeEveryDays === 0) freezes = Math.min(cfg.maxFreezes, freezes + 1);
  return { flame, best: Math.max(s.best, flame), freezes, lastPlayDay: day, increased: true, frozenDays, broke };
}

/** What Today shows: the flame survives a gap only if held freezes can cover it. */
export function displayFlame(s: FlameState, today: string) {
  if (!s.lastPlayDay) return { value: 0, safeToday: false };
  const gap = daysBetween(s.lastPlayDay, today);
  if (gap <= 0) return { value: s.flame, safeToday: true };
  if (gap - 1 <= s.freezes) return { value: s.flame, safeToday: false };
  return { value: 0, safeToday: false };
}

/**
 * Streak length ending on `end`, from per-day history: played days count 1, frozen/repaired days
 * keep the run alive without adding, any other day ends it.
 */
export function streakEndingAt(history: Map<string, { played: boolean; kept: boolean }>, end: string) {
  let n = 0;
  for (let day = end; ; day = addDays(day, -1)) {
    const d = history.get(day);
    if (!d || (!d.played && !d.kept)) return n;
    if (d.played) n++;
  }
}

// ---------- Leaderboard & daily ----------
/** Monday of the week containing `day` (weekly leaderboard resets Mon 00:00 IST). */
export function weekStart(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

export const dailyNumber = (day: string, launchDay: string) => daysBetween(launchDay, day) + 1;

/** Grade a daily answer against the prompt's answer distribution (most common first). */
export function dailyGrade(key: string | null, ranked: string[]): DailyGrade {
  if (!key) return "none";
  const i = ranked.indexOf(key);
  return i === 0 ? "top" : i > 0 && i < 5 ? "top5" : "none";
}

export const DAILY_EMOJI: Record<DailyGrade, string> = { top: "🟩", top5: "🟨", none: "⬜" };

// ---------- Misc ----------
/** "vivek.t@okaxis" → "v***@okaxis" — the full UPI ID is never stored in the demo. */
export function maskUpi(upi: string) {
  const [name, handle] = upi.split("@");
  return `${(name ?? "").slice(0, 1)}***@${handle ?? ""}`;
}

const ADJECTIVES = ["sunny", "quick", "calm", "bright", "lucky", "kind", "brave", "chill", "jolly", "swift", "witty", "zesty"];
const NOUNS = ["mango", "kite", "chai", "tiger", "lotus", "monsoon", "peacock", "rocket", "samosa", "comet", "banyan", "coconut"];

/** Friendly default handle, `^[a-z0-9_]{3,20}$`, e.g. "sunny_mango_482". */
export function generateHandle(rand: () => number) {
  const p = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  return `${p(ADJECTIVES)}_${p(NOUNS)}_${100 + Math.floor(rand() * 900)}`.slice(0, 20);
}
