// Public system routes (health, config) and server-to-server jobs (bearer secret).
import { timingSafeEqual } from "node:crypto";
import { Router, type RequestHandler } from "express";
import { sql } from "drizzle-orm";
import { api, UI_LANGS, z } from "@shared";
import { env } from "../config.js";
import { db } from "../db/client.js";
import { AppError } from "../lib/errors.js";
import { getConfig } from "../services/config.service.js";
import { wordList } from "../services/content.service.js";
import { googleLinkingAvailable } from "../services/identity.service.js";
import { send } from "./respond.js";

export const systemRoutes = Router();

systemRoutes.get("/health", async (_req, res) => {
  let up = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    up = false;
  }
  res.status(up ? 200 : 503).json({ ok: up, db: up ? "up" : "down", version: process.env.npm_package_version ?? "dev" });
});

systemRoutes.get("/config", async (_req, res) => {
  const cfg = await getConfig();
  res.setHeader("Cache-Control", "public, max-age=300");
  send(res, api.GameConfigPublic, {
    paidEnabled: cfg.paid_enabled,
    demoMode: env.DEMO_MODE,
    minPayoutPaise: cfg.payout.minPaise,
    paidPacksPerDay: cfg.packs.paidPerDay,
    roundSeconds: { default: cfg.round.seconds, sound: cfg.round.soundSeconds },
    languages: [...UI_LANGS],
    linking: { google: googleLinkingAvailable() },
    payoutMode: cfg.payout.mode,
  });
});

/** Smart Chips word lists (D39). Public and cacheable: plain words per language, no concept map (T17). */
systemRoutes.get("/words", async (req, res) => {
  const list = await wordList();
  const etag = `"w-${list.version}"`;
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("ETag", etag);
  if (req.get("if-none-match") === etag) {
    res.status(304).end();
    return;
  }
  send(res, api.WordList, list);
});

// ---------- Jobs: called by scheduled GitHub Actions with `Authorization: Bearer $JOBS_SECRET` ----------
const bearer = (): RequestHandler => (req, _res, next) => {
  const got = Buffer.from((req.get("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(env.JOBS_SECRET);
  if (got.length !== want.length || !timingSafeEqual(got, want)) throw new AppError("FORBIDDEN");
  next();
};

export const jobRoutes = Router();

/** Weekly housekeeping (docs/DATA_MODEL.md §4): old events, old rate-limit windows, expired sessions. */
jobRoutes.post("/prune", bearer(), async (_req, res) => {
  const [e] = await db.execute<{ n: number }>(sql`with d as (delete from events where created_at < now() - interval '90 days' returning 1) select count(*)::int as n from d`);
  const [r] = await db.execute<{ n: number }>(sql`with d as (delete from rate_limits where window_start < now() - interval '2 days' returning 1) select count(*)::int as n from d`);
  const [s] = await db.execute<{ n: number }>(sql`with d as (delete from sessions where expires_at < now() returning 1) select count(*)::int as n from d`);
  send(res, z.object({ events: z.number(), rateLimits: z.number(), sessions: z.number() }), {
    events: e?.n ?? 0,
    rateLimits: r?.n ?? 0,
    sessions: s?.n ?? 0,
  });
});
