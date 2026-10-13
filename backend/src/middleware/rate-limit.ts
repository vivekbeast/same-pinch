import type { RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";

const WINDOWS = { "1m": 60_000, "1h": 3_600_000, "1d": 86_400_000 } as const;
export type Window = keyof typeof WINDOWS;

/** Fixed-window counter in Postgres (no Redis). Returns the count after this hit. */
export async function hit(key: string, bucket: string, window: Window): Promise<{ count: number; resetMs: number }> {
  const size = WINDOWS[window];
  const start = Math.floor(Date.now() / size) * size;
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, bucket, window_start, count)
    values (${key}, ${bucket}, ${new Date(start).toISOString()}, 1)
    on conflict (key, bucket, window_start) do update set count = rate_limits.count + 1
    returning count`);
  return { count: Number(rows[0]!.count), resetMs: start + size - Date.now() };
}

/** Limit per user when signed in, otherwise per IP. `by: "ip"` forces IP (sign-in endpoints). */
export const rateLimit =
  (bucket: string, max: number, window: Window, by: "user" | "ip" = "user"): RequestHandler =>
  async (req, _res, next) => {
    const key = by === "user" && req.user ? req.user.id : `ip:${req.ip}`;
    const { count, resetMs } = await hit(key, bucket, window);
    if (count > max) throw new AppError("RATE_LIMITED", undefined, { "Retry-After": String(Math.ceil(resetMs / 1000)) });
    next();
  };
