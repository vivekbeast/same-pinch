// Sync Map and weekly leaderboard. Leaderboards rank XP only — never ₹ (docs/GAME_DESIGN.md §12).
import { asc, eq, sql } from "drizzle-orm";
import type { api, LeaderboardScope, z } from "@shared";
import { db } from "../db/client.js";
import { userRegions } from "../db/schema.js";
import { levelFor, weekStart } from "../domain/rules.js";
import { TtlCache } from "../lib/cache.js";
import type { SessionUser } from "../types.js";
import { getConfig } from "./config.service.js";
import { todayIst } from "./daily.service.js";

type MapDto = z.infer<typeof api.MapResponse>;
type LeaderboardDto = z.infer<typeof api.Leaderboard>;
type PeopleDto = z.infer<typeof api.PeopleResponse>;

/**
 * People you've shared a moment with (D44): partners on rounds where your words matched (exact/bhasha)
 * or you pinched the same spot. Newest first, one row per person. Handles and avatars only — never ids.
 */
export async function getPeople(userId: string): Promise<PeopleDto> {
  const rows = await db.execute<{
    handle: string;
    avatar: string;
    state_code: string | null;
    moments: number;
    last_at: Date;
    last: "exact" | "bhasha" | "spot";
  }>(sql`
    with m as (
      select pu.id as pid, pu.handle, pu.avatar,
             coalesce(pa.author_state, pu.state_code) as state, me.received_at,
             case when me.result in ('exact', 'bhasha') then me.result::text else 'spot' end as kind
      from answers me
      join answers pa on pa.id = me.partner_answer_id
      join users pu on pu.id = pa.user_id
      where me.user_id = ${userId}
        and not me.flagged
        and not pu.is_flagged
        and (me.result in ('exact', 'bhasha') or me.spot_match)
    )
    select handle, avatar,
           (array_agg(state order by received_at desc))[1] as state_code,
           count(*)::int as moments,
           max(received_at) as last_at,
           (array_agg(kind order by received_at desc))[1] as last
    from m
    group by pid, handle, avatar
    order by max(received_at) desc
    limit 30`);
  return {
    people: rows.map((r) => ({
      handle: r.handle,
      avatar: r.avatar as PeopleDto["people"][number]["avatar"],
      stateCode: (r.state_code as PeopleDto["people"][number]["stateCode"]) ?? null,
      moments: r.moments,
      lastAt: new Date(r.last_at).toISOString(),
      last: r.last,
    })),
  };
}

export async function getMap(userId: string): Promise<MapDto> {
  const rows = await db.select().from(userRegions).where(eq(userRegions.userId, userId)).orderBy(asc(userRegions.firstAt));
  return {
    synced: rows.map((r) => ({ stateCode: r.stateCode as MapDto["synced"][number]["stateCode"], pinches: r.pinchCount, firstAt: r.firstAt.toISOString() })),
    total: 36,
  };
}

interface Board {
  top: { userId: string; handle: string; avatar: string; xp: number; totalXp: number }[];
}
const boards = new TtlCache<Board>(60_000, 500);

function scopeFilter(scope: LeaderboardScope, user: SessionUser) {
  if (scope === "city") return user.city && user.stateCode ? sql`and u.city = ${user.city} and u.state_code = ${user.stateCode}` : null;
  if (scope === "state") return user.stateCode ? sql`and u.state_code = ${user.stateCode}` : null;
  return sql``;
}

export async function getLeaderboard(user: SessionUser, scope: LeaderboardScope): Promise<LeaderboardDto> {
  const cfg = await getConfig();
  const ws = weekStart(todayIst());
  const filter = scopeFilter(scope, user);
  if (!filter) return { weekStart: ws, me: null, top: [] }; // no city/state set yet

  const key = `${ws}|${scope}|${scope === "india" ? "" : `${user.stateCode}|${scope === "city" ? user.city : ""}`}`;
  const board = await boards.getOrSet(key, async () => {
    const rows = await db.execute<{ user_id: string; handle: string; avatar: string; xp: number; total_xp: number }>(sql`
      select u.id as user_id, u.handle, u.avatar, sum(d.xp)::int as xp, u.xp as total_xp
      from user_days d join users u on u.id = d.user_id
      where d.day >= ${ws} and not u.is_flagged ${filter}
      group by u.id having sum(d.xp) > 0
      order by xp desc, u.handle
      limit 20`);
    return { top: rows.map((r) => ({ userId: r.user_id, handle: r.handle, avatar: r.avatar, xp: r.xp, totalXp: r.total_xp })) };
  });

  // My rank is always live (not cached): count players in scope with more XP this week.
  const [mine] = await db.execute<{ xp: number; ahead: number }>(sql`
    with week as (
      select d.user_id, sum(d.xp)::int as xp
      from user_days d join users u on u.id = d.user_id
      where d.day >= ${ws} and not u.is_flagged ${filter}
      group by d.user_id
    )
    select coalesce((select xp from week where user_id = ${user.id}), 0) as xp,
           (select count(*)::int from week where xp > coalesce((select xp from week where user_id = ${user.id}), 0)) as ahead`);

  return {
    weekStart: ws,
    me: mine && mine.xp > 0 ? { rank: mine.ahead + 1, xp: mine.xp } : null,
    // Never user IDs in the payload (docs/API.md).
    top: board.top.map((r, i) => ({
      rank: i + 1,
      handle: r.handle,
      avatar: r.avatar as LeaderboardDto["top"][number]["avatar"],
      level: levelFor(r.totalXp, cfg.levels).value,
      xp: r.xp,
    })),
  };
}
