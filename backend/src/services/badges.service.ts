// Badge rules live in the `badges` table as JSON (docs/GAME_DESIGN.md §13); evaluated after collect/daily.
import { eq, sql } from "drizzle-orm";
import type { BadgeId } from "@shared";
import type { Tx } from "../db/client.js";
import { badges, userBadges } from "../db/schema.js";

type Rule =
  | { type: "pinches"; count: number }
  | { type: "bhasha_pinches"; count: number }
  | { type: "multi_match_round"; matches: number }
  | { type: "flame"; days: number }
  | { type: "pinch_with_burnt"; burnt: number }
  | { type: "kind_pinches"; kind: string; count: number }
  | { type: "regions"; count: number }
  | { type: "daily_perfect" }
  | { type: "gold_streak"; count: number }
  | { type: "twin"; count: number }; // pinches with one person within the last 7 days

interface Stats {
  pinches: number;
  bhasha: number;
  maxMatches: number;
  soundPinches: number;
  vibePinches: number;
  maxBurntPinched: number;
  regions: number;
  dailyPerfect: boolean;
  flame: number;
  goldStreak: number;
  /** Most pinches with any one person in the last 7 days (Brain Twin). */
  twinPinches: number;
}

export function earned(rule: Rule, s: Stats): boolean {
  switch (rule.type) {
    case "pinches":
      return s.pinches >= rule.count;
    case "bhasha_pinches":
      return s.bhasha >= rule.count;
    case "multi_match_round":
      return s.maxMatches >= rule.matches;
    case "flame":
      return s.flame >= rule.days;
    case "pinch_with_burnt":
      return s.maxBurntPinched >= rule.burnt;
    case "kind_pinches":
      return (rule.kind === "sound" ? s.soundPinches : rule.kind === "vibe" ? s.vibePinches : 0) >= rule.count;
    case "regions":
      return s.regions >= rule.count;
    case "daily_perfect":
      return s.dailyPerfect;
    case "gold_streak":
      return s.goldStreak >= rule.count;
    case "twin":
      return s.twinPinches >= rule.count;
  }
}

/** Award any newly earned badges; returns their ids (for the unlock sheet). */
export async function evaluateBadges(tx: Tx, userId: string, flame: number, goldStreak: number): Promise<BadgeId[]> {
  const [row] = await tx.execute<{
    pinches: number;
    bhasha: number;
    max_matches: number;
    sound: number;
    vibe: number;
    max_burnt: number;
    regions: number;
    daily_perfect: boolean;
    twin: number;
  }>(sql`
    with mine as (
      select a.result, a.match_concepts, a.prompt_id, p.kind
      from answers a join prompts p on p.id = a.prompt_id
      where a.user_id = ${userId} and a.result in ('exact', 'bhasha') and not a.flagged
    )
    select
      count(*)::int as pinches,
      count(*) filter (where result = 'bhasha')::int as bhasha,
      coalesce(max(cardinality(match_concepts)), 0)::int as max_matches,
      count(*) filter (where kind = 'sound')::int as sound,
      count(*) filter (where kind = 'vibe')::int as vibe,
      coalesce((select max(n) from (
        select count(*) as n from prompt_burnt pb where pb.prompt_id in (select prompt_id from mine) group by pb.prompt_id
      ) b), 0)::int as max_burnt,
      (select count(*)::int from user_regions where user_id = ${userId}) as regions,
      exists (
        select 1 from daily_answers where user_id = ${userId} and grade = 'top' group by day having count(*) >= 5
      ) as daily_perfect,
      coalesce((select max(n) from (
        select count(*) as n
        from answers me join answers pa on pa.id = me.partner_answer_id
        where me.user_id = ${userId} and not me.flagged and me.result in ('exact', 'bhasha')
          and pa.user_id is not null and me.received_at > now() - interval '7 days'
        group by pa.user_id
      ) t), 0)::int as twin
    from mine`);

  const stats: Stats = {
    pinches: row?.pinches ?? 0,
    bhasha: row?.bhasha ?? 0,
    maxMatches: row?.max_matches ?? 0,
    soundPinches: row?.sound ?? 0,
    vibePinches: row?.vibe ?? 0,
    maxBurntPinched: row?.max_burnt ?? 0,
    regions: row?.regions ?? 0,
    dailyPerfect: row?.daily_perfect ?? false,
    flame,
    goldStreak,
    twinPinches: row?.twin ?? 0,
  };

  const all = await tx.select({ id: badges.id, rule: badges.rule }).from(badges);
  const have = new Set((await tx.select({ id: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId))).map((b) => b.id));
  const fresh = all.filter((b) => !have.has(b.id) && earned(b.rule as Rule, stats)).map((b) => b.id);
  if (fresh.length) await tx.insert(userBadges).values(fresh.map((badgeId) => ({ userId, badgeId }))).onConflictDoNothing();
  return fresh;
}
