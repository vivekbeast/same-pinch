import { Router } from "express";
import { api, z } from "@shared";
import { validate } from "../middleware/basics.js";
import { rateLimit } from "../middleware/rate-limit.js";
import * as auth from "../services/auth.service.js";
import * as identity from "../services/identity.service.js";
import { buildMe } from "../services/player.service.js";
import { requireFreshSession, requireUser } from "../services/session.service.js";
import { oauthCookieOptions } from "./google-callback.js";
import { send } from "./respond.js";

export const authRoutes = Router();

authRoutes.post("/anon", rateLimit("auth_anon", 20, "1h", "ip"), validate({ body: api.AnonInput }), async (req, res) => {
  const { uiLang, stateCode, city } = req.valid.body as z.infer<typeof api.AnonInput>;
  const { userId, restoreCode } = await auth.startAnonymous(req, res, { uiLang, stateCode, city });
  send(res, api.MeResponse, { user: await buildMe(userId, restoreCode) }, 201);
});

authRoutes.post("/restore", rateLimit("auth_restore", 5, "1h", "ip"), validate({ body: api.RestoreInput }), async (req, res) => {
  const { code } = req.valid.body as z.infer<typeof api.RestoreInput>;
  const { userId, restoreCode } = await auth.restore(req, res, code);
  send(res, api.MeResponse, { user: await buildMe(userId, restoreCode) });
});

authRoutes.post("/demo", rateLimit("auth_demo", 20, "1h", "ip"), async (req, res) => {
  const { userId, restoreCode } = await auth.startDemo(req, res);
  send(res, api.MeResponse, { user: await buildMe(userId, restoreCode) });
});

authRoutes.post("/logout", async (req, res) => {
  await auth.logout(req, res);
  res.status(204).end();
});

authRoutes.post("/logout-all", requireUser(), rateLimit("auth_logout_all", 5, "1d"), async (req, res) => {
  await auth.logoutAll(req.user!.id);
  await auth.logout(req, res);
  res.status(204).end();
});

// ---------- Stage 2: secure the account with Google (OAuth redirect flow) ----------
const GoogleStartQuery = z.object({ intent: z.enum(["login", "link"]).default("login"), returnTo: z.string().optional() });

/**
 * GET /auth/google/start?intent=login|link&returnTo=/settings — a top-level navigation, not fetch().
 * Sets the signed flow cookie and redirects to Google. Problems redirect back to the app with a flag.
 */
authRoutes.get("/google/start", rateLimit("google_start", 30, "1h", "ip"), validate({ query: GoogleStartQuery }), (req, res) => {
  const { intent, returnTo: raw } = req.valid.query as z.infer<typeof GoogleStartQuery>;
  const returnTo = identity.safeReturnTo(raw);
  if (!identity.googleLinkingAvailable()) return res.redirect(302, identity.appUrl(returnTo, { auth_error: "google_unavailable" }));
  if (intent === "link" && !req.user) return res.redirect(302, identity.appUrl(returnTo, { auth_error: "signin_required" }));
  const { url, cookie } = identity.beginGoogle(intent, returnTo, req.user?.id);
  res.cookie(identity.OAUTH_COOKIE, cookie, oauthCookieOptions());
  res.redirect(302, url);
});

authRoutes.delete("/link/:provider", requireUser(), requireFreshSession(), validate({ params: api.IdentityProviderParam }), async (req, res) => {
  const { provider } = req.valid.params as z.infer<typeof api.IdentityProviderParam>;
  await identity.unlink(req.user!.id, provider);
  send(res, api.MeResponse, { user: await buildMe(req.user!.id) });
});

/** Settings → "Show my restore code": rotates and returns the new code once. */
authRoutes.post("/restore-code", requireUser(), requireFreshSession(), rateLimit("auth_restore_code", 10, "1d"), async (req, res) => {
  const code = await auth.rotateRestoreCode(req.user!.id, req.user!.handle);
  send(res, z.object({ code: z.string() }), { code });
});
