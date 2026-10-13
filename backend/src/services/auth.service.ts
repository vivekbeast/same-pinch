// Sign-in flows: anonymous start, restore code, demo account, logout (docs/BACKEND.md §4).
import { randomInt } from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { TERMS_VERSION, type UiLang } from "@shared";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { DEMO_USER } from "../db/seed/data/reference.js";
import { env } from "../config.js";
import { generateHandle } from "../domain/rules.js";
import { hashSecret, newRestoreCode } from "../lib/crypto.js";
import { AppError, pgCode } from "../lib/errors.js";
import { endAllSessions, endSession, startSession } from "./session.service.js";

const rand = () => randomInt(1_000_000) / 1_000_000;
const isUniqueViolation = (e: unknown) => pgCode(e) === "23505";

/** POST /auth/anon — a new player: generated handle, restore code shown once, session cookie. */
export async function startAnonymous(
  req: Request,
  res: Response,
  input: { uiLang: UiLang; stateCode: string; city?: string },
) {
  const restoreCode = newRestoreCode();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const userId = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(users)
          .values({
            handle: generateHandle(rand),
            uiLang: input.uiLang,
            deviceHash: req.deviceHash,
            restoreCodeHash: hashSecret(restoreCode, env.SESSION_PEPPER),
            ageConfirmedAt: new Date(),
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
            stateCode: input.stateCode,
            city: input.city ?? null,
          })
          .returning({ id: users.id });
        await startSession(tx, res, u!.id, req.deviceHash);
        return u!.id;
      });
      return { userId, restoreCode };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // handle collision → try another
    }
  }
  throw new AppError("INTERNAL", "could not allocate a handle");
}

const isDemo = (handle: string) => env.DEMO_MODE && handle === DEMO_USER.handle;

/**
 * POST /auth/restore — move to a new device. The code rotates on every use (the shared demo
 * account keeps its public code so every reviewer can use it).
 */
export async function restore(req: Request, res: Response, code: string) {
  const hash = hashSecret(code, env.SESSION_PEPPER);
  return db.transaction(async (tx) => {
    const [u] = await tx
      .select({ id: users.id, handle: users.handle })
      .from(users)
      .where(eq(users.restoreCodeHash, hash))
      .for("update")
      .limit(1);
    if (!u) throw new AppError("NOT_FOUND");

    let newCode: string | null = null;
    if (!isDemo(u.handle)) {
      newCode = newRestoreCode();
      await tx.update(users).set({ restoreCodeHash: hashSecret(newCode, env.SESSION_PEPPER) }).where(eq(users.id, u.id));
    }
    await startSession(tx, res, u.id, req.deviceHash);
    return { userId: u.id, restoreCode: newCode ?? DEMO_USER.restoreCode };
  });
}

/** POST /auth/demo — one tap into the seeded demo account (DEMO_MODE only). */
export async function startDemo(req: Request, res: Response) {
  if (!env.DEMO_MODE) throw new AppError("NOT_FOUND");
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.handle, DEMO_USER.handle)).limit(1);
    if (!u) throw new AppError("NOT_FOUND");
    await startSession(tx, res, u.id, req.deviceHash);
    return { userId: u.id, restoreCode: DEMO_USER.restoreCode };
  });
}

/** POST /auth/restore-code — show the code in Settings. Rotating it is the only way to show it again. */
export async function rotateRestoreCode(userId: string, handle: string) {
  if (isDemo(handle)) return DEMO_USER.restoreCode;
  const code = newRestoreCode();
  await db.update(users).set({ restoreCodeHash: hashSecret(code, env.SESSION_PEPPER) }).where(eq(users.id, userId));
  return code;
}

export const logout = (req: Request, res: Response) => endSession(req, res);
export const logoutAll = (userId: string) => endAllSessions(userId);
