// Anonymous device sessions (docs/BACKEND.md §4): opaque 32-byte token in an HttpOnly cookie,
// only its keyed hash stored, 90-day sliding expiry, revocable instantly (logout clears the cache).
import type { Request, RequestHandler, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, type Tx } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { env } from "../config.js";
import { TtlCache } from "../lib/cache.js";
import { hashSecret, newSessionToken } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import type { SessionUser } from "../types.js";

export const COOKIE = "sp_sid";
const MAX_AGE_MS = 90 * 86_400_000;
const RENEW_AFTER_MS = 7 * 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Cached {
  user: SessionUser;
  expiresAt: number;
  renewedAt: number;
}
const cache = new TtlCache<Cached>(60_000);

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_MS,
});

/** sha256-HMAC of the X-SP-Device UUID — a fraud signal, not a fingerprint. */
export function deviceHashOf(req: Request): string | undefined {
  const id = req.get("x-sp-device");
  return id && UUID.test(id) ? hashSecret(id.toLowerCase(), env.DEVICE_PEPPER) : undefined;
}

export async function startSession(tx: Tx, res: Response, userId: string, deviceHash?: string) {
  const token = newSessionToken();
  const now = Date.now();
  await tx.insert(sessions).values({
    tokenHash: hashSecret(token, env.SESSION_PEPPER),
    userId,
    deviceHash,
    createdAt: new Date(now),
    renewedAt: new Date(now),
    expiresAt: new Date(now + MAX_AGE_MS),
  });
  res.cookie(COOKIE, token, cookieOptions());
}

export async function endSession(req: Request, res: Response) {
  if (req.sessionTokenHash) {
    await db.delete(sessions).where(eq(sessions.tokenHash, req.sessionTokenHash));
    cache.delete(req.sessionTokenHash);
  }
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

export async function endAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  invalidateUser(userId);
}

/** Drop cached sessions of a user after their row changes (settings, handle, deletion). */
export function invalidateUser(userId: string) {
  cache.deleteWhere((v) => v.user.id === userId);
}

async function loadFromDb(tokenHash: string): Promise<Cached | undefined> {
  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt, renewedAt: sessions.renewedAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return undefined;
  return { user: row.user, expiresAt: row.expiresAt.getTime(), renewedAt: row.renewedAt.getTime() };
}

/** Loads req.user from the cookie (cached 60 s) and slides the expiry once a week. Never throws for anonymous requests. */
export const session = (): RequestHandler => async (req, res, next) => {
  req.deviceHash = deviceHashOf(req);
  const token: unknown = req.cookies?.[COOKIE];
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return next();

  const tokenHash = hashSecret(token, env.SESSION_PEPPER);
  let s = cache.get(tokenHash);
  if (!s || s.expiresAt < Date.now()) {
    s = await loadFromDb(tokenHash);
    if (!s) return next();
    cache.set(tokenHash, s);
  }

  if (Date.now() - s.renewedAt > RENEW_AFTER_MS) {
    const now = Date.now();
    await db
      .update(sessions)
      .set({ renewedAt: new Date(now), expiresAt: new Date(now + MAX_AGE_MS) })
      .where(eq(sessions.tokenHash, tokenHash));
    s = { ...s, renewedAt: now, expiresAt: now + MAX_AGE_MS };
    cache.set(tokenHash, s);
    res.cookie(COOKIE, token, cookieOptions());
  }

  req.user = s.user;
  req.sessionTokenHash = tokenHash;
  next();
};

export const requireUser = (): RequestHandler => (req, _res, next) => {
  if (!req.user) throw new AppError("UNAUTHENTICATED");
  next();
};

/** Money-moving routes re-check the session in the database, bypassing the cache (docs/DECISIONS.md D6). */
export const requireFreshSession = (): RequestHandler => async (req, _res, next) => {
  if (!req.sessionTokenHash) throw new AppError("UNAUTHENTICATED");
  const s = await loadFromDb(req.sessionTokenHash);
  if (!s) {
    cache.delete(req.sessionTokenHash);
    throw new AppError("UNAUTHENTICATED");
  }
  req.user = s.user;
  next();
};
