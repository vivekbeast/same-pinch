// The OAuth redirect URI handler. Mounted at the path of GOOGLE_REDIRECT_URI (must match the Google
// console exactly, e.g. /api/auth/google/callback). Always answers with a redirect back to the app.
import type { CookieOptions, RequestHandler } from "express";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { FLOW_TTL_MS, finishGoogle, OAUTH_COOKIE } from "../services/identity.service.js";
import { startSession } from "../services/session.service.js";

export const oauthCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax", // sent on the top-level GET back from accounts.google.com
  path: "/",
  maxAge: FLOW_TTL_MS,
});

export const googleCallbackPath = () => (env.GOOGLE_REDIRECT_URI ? new URL(env.GOOGLE_REDIRECT_URI).pathname : "/api/auth/google/callback");

export const googleCallback = (): RequestHandler => async (req, res) => {
  const { redirect, signInUserId } = await finishGoogle(req.query, req.cookies?.[OAUTH_COOKIE], req.user?.id);
  res.clearCookie(OAUTH_COOKIE, { ...oauthCookieOptions(), maxAge: undefined }); // single use
  if (signInUserId) await db.transaction((tx) => startSession(tx, res, signInUserId, req.deviceHash));
  res.redirect(302, redirect);
};
