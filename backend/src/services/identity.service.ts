// Stage 2 — "secure your account" with Google (docs/DECISIONS.md D27, D29).
// Server-side OAuth 2.0 authorization-code flow with PKCE: the client secret never leaves the server,
// and `state` + `nonce` + the PKCE verifier are bound to a short-lived signed HttpOnly cookie.
// Linking keeps the same user row (all progress stays); a linked Google account is another sign-in
// route next to the restore code. Google ids are stored only as keyed hashes.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IdentityProvider } from "@shared";
import { db } from "../db/client.js";
import { authIdentities } from "../db/schema.js";
import { env } from "../config.js";
import { hashSecret } from "../lib/crypto.js";
import { AppError, pgCode } from "../lib/errors.js";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const OAUTH_COOKIE = "sp_oauth";
export const FLOW_TTL_MS = 10 * 60_000;

export const googleLinkingAvailable = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);

const b64url = (buf: Buffer) => buf.toString("base64url");
const random = () => b64url(randomBytes(32));
const subjectHash = (provider: IdentityProvider, subject: string) => hashSecret(`${provider}:${subject}`, env.SESSION_PEPPER);

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${(name ?? "").slice(0, 1)}•••@${domain ?? ""}`;
}

/** Only same-app paths: "/settings" ok; "//evil.com", "https://…", "/\evil" are not (open-redirect guard). */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 200 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw;
}

/** Back to the web app with a status flag the UI turns into a toast. */
export function appUrl(returnTo: string, params: Record<string, string>) {
  const u = new URL(returnTo, env.APP_ORIGIN);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

// ---------- The signed flow cookie ----------
interface Flow {
  state: string;
  verifier: string;
  nonce: string;
  intent: "login" | "link";
  returnTo: string;
  userId?: string; // link: who started it
  exp: number;
}

const sign = (payload: string) => b64url(createHmac("sha256", env.SESSION_PEPPER).update(`oauth:${payload}`).digest());

function sealFlow(flow: Flow) {
  const payload = b64url(Buffer.from(JSON.stringify(flow)));
  return `${payload}.${sign(payload)}`;
}

function openFlow(cookie: unknown): Flow | null {
  if (typeof cookie !== "string") return null;
  const [payload, mac] = cookie.split(".");
  if (!payload || !mac) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString()) as Flow;
    return flow.exp > Date.now() ? flow : null;
  } catch {
    return null;
  }
}

/** Step 1: where to send the browser, plus the cookie that proves the callback belongs to this browser. */
export function beginGoogle(intent: Flow["intent"], returnTo: string, userId?: string) {
  if (!googleLinkingAvailable()) throw new AppError("PROVIDER_UNAVAILABLE");
  const flow: Flow = { state: random(), verifier: random(), nonce: random(), intent, returnTo, userId, exp: Date.now() + FLOW_TTL_MS };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "openid email",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: b64url(createHash("sha256").update(flow.verifier).digest()),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: sealFlow(flow) };
}

// ---------- Code exchange (swappable in tests) ----------
export interface GoogleClaims {
  sub: string;
  email: string;
}

async function exchangeWithGoogle(code: string, verifier: string, nonce: string): Promise<GoogleClaims> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("google token exchange: no id_token");
  const { payload } = await jwtVerify(id_token, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID!,
  });
  if (payload.nonce !== nonce) throw new Error("google: nonce mismatch");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("google: unverified email");
  }
  return { sub: payload.sub, email: payload.email };
}

let exchange = exchangeWithGoogle;
/** Tests swap in a fake exchanger (no network). */
export const setGoogleExchange = (fn: typeof exchangeWithGoogle) => {
  exchange = fn;
};

// ---------- Identities ----------
/** Link (or replace) this player's Google account. One owned by someone else → IDENTITY_TAKEN. */
async function upsertIdentity(userId: string, provider: IdentityProvider, hash: string, display: string) {
  const [owner] = await db
    .select({ userId: authIdentities.userId })
    .from(authIdentities)
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.subjectHash, hash)));
  if (owner && owner.userId !== userId) throw new AppError("IDENTITY_TAKEN");
  try {
    await db
      .insert(authIdentities)
      .values({ userId, provider, subjectHash: hash, display })
      .onConflictDoUpdate({
        target: [authIdentities.userId, authIdentities.provider],
        set: { subjectHash: hash, display, verifiedAt: new Date() },
      });
  } catch (e) {
    if (pgCode(e) === "23505") throw new AppError("IDENTITY_TAKEN"); // lost a race to another account
    throw e;
  }
}

export async function unlink(userId: string, provider: IdentityProvider) {
  await db.delete(authIdentities).where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, provider)));
}

export async function identitiesOf(userId: string) {
  return db
    .select({ provider: authIdentities.provider, display: authIdentities.display, verifiedAt: authIdentities.verifiedAt })
    .from(authIdentities)
    .where(eq(authIdentities.userId, userId));
}

export const googleSubjectHash = (sub: string) => subjectHash("google", sub);

/**
 * Step 2 (the redirect URI): validate state against the cookie, exchange the code, then either sign in
 * (`login`) or attach Google to the signed-in player (`link`). Always ends in a redirect to the app;
 * failures become an `auth_error` flag — never a JSON error page or a stack trace.
 */
export async function finishGoogle(
  query: { code?: unknown; state?: unknown; error?: unknown },
  cookie: unknown,
  currentUserId: string | undefined,
): Promise<{ redirect: string; signInUserId?: string }> {
  const flow = openFlow(cookie);
  const back = (params: Record<string, string>) => appUrl(flow?.returnTo ?? "/", params);

  if (!flow || typeof query.state !== "string" || query.state !== flow.state) return { redirect: back({ auth_error: "google_failed" }) };
  if (query.error) return { redirect: back({ auth_error: "google_cancelled" }) };
  if (typeof query.code !== "string" || !query.code) return { redirect: back({ auth_error: "google_failed" }) };

  let claims: GoogleClaims;
  try {
    claims = await exchange(query.code, flow.verifier, flow.nonce);
  } catch {
    return { redirect: back({ auth_error: "google_failed" }) };
  }
  const hash = googleSubjectHash(claims.sub);

  if (flow.intent === "login") {
    const [owner] = await db
      .update(authIdentities)
      .set({ lastUsedAt: new Date() })
      .where(and(eq(authIdentities.provider, "google"), eq(authIdentities.subjectHash, hash)))
      .returning({ userId: authIdentities.userId });
    if (!owner) return { redirect: back({ auth_error: "google_not_linked" }) };
    return { redirect: back({ signed_in: "google" }), signInUserId: owner.userId };
  }

  // link: the same player who started the flow must still be signed in on this browser
  if (!flow.userId || flow.userId !== currentUserId) return { redirect: back({ auth_error: "google_failed" }) };
  try {
    await upsertIdentity(flow.userId, "google", hash, maskEmail(claims.email));
  } catch (e) {
    if (e instanceof AppError && e.code === "IDENTITY_TAKEN") return { redirect: back({ auth_error: "identity_taken" }) };
    throw e;
  }
  return { redirect: back({ linked: "google" }) };
}
