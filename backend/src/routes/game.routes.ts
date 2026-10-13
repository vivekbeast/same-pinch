// Authenticated game routes: me, packs, rounds, daily, wallet, map, leaderboard, events.
import { Router } from "express";
import { api, EVENT_NAMES, z } from "@shared";
import { db } from "../db/client.js";
import { events } from "../db/schema.js";
import { validate } from "../middleware/basics.js";
import { rateLimit } from "../middleware/rate-limit.js";
import * as account from "../services/account.service.js";
import { collectPack } from "../services/collect.service.js";
import * as daily from "../services/daily.service.js";
import { createPack, getPack } from "../services/pack.service.js";
import { buildMe } from "../services/player.service.js";
import { submitRound } from "../services/round.service.js";
import { endSession, requireFreshSession } from "../services/session.service.js";
import { getLeaderboard, getMap, getPeople } from "../services/social.service.js";
import * as notes from "../services/notes.service.js";
import * as wallet from "../services/wallet.service.js";
import { send } from "./respond.js";

export const gameRoutes = Router();

const PackParams = z.object({ packId: z.uuid() });
const DayParams = z.object({ day: api.IsoDate });
const LedgerQuery = z.object({ cursor: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(100).default(30) });

// ---------- Me ----------
gameRoutes.get("/me", async (req, res) => {
  send(res, api.MeResponse, { user: await buildMe(req.user!.id) });
});

gameRoutes.patch("/me", rateLimit("me_patch", 20, "1h"), validate({ body: api.PatchMeInput }), async (req, res) => {
  await account.patchMe(req.user!.id, req.valid.body as z.infer<typeof api.PatchMeInput>);
  send(res, api.MeResponse, { user: await buildMe(req.user!.id) });
});

gameRoutes.get("/me/badges", async (req, res) => {
  send(res, api.MeBadges, await account.myBadges(req.user!.id));
});

gameRoutes.get("/me/export", rateLimit("me_export", 2, "1d"), async (req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="same-pinch-data.json"');
  res.json(await account.exportMe(req.user!.id));
});

gameRoutes.delete("/me", requireFreshSession(), async (req, res) => {
  await account.deleteMe(req.user!.id);
  await endSession(req, res);
  res.status(204).end();
});

// ---------- Packs & rounds ----------
// Flood guard only; the real "packs per hour" limit counts created packs inside createPack (D44).
gameRoutes.post("/packs", rateLimit("packs", 240, "1h"), async (req, res) => {
  send(res, api.Pack, await createPack(req.user!), 201);
});

gameRoutes.get("/packs/:packId", validate({ params: PackParams }), async (req, res) => {
  const { packId } = req.valid.params as z.infer<typeof PackParams>;
  send(res, api.Pack, await getPack(req.user!, packId));
});

gameRoutes.post("/rounds", rateLimit("rounds", 60, "1m"), validate({ body: api.SubmitRoundInput }), async (req, res) => {
  const input = req.valid.body as z.infer<typeof api.SubmitRoundInput>;
  send(res, api.RoundResultResponse, await submitRound(req.user!, req.deviceHash, input));
});

gameRoutes.post("/packs/:packId/collect", requireFreshSession(), rateLimit("collect", 40, "1h"), validate({ params: PackParams }), async (req, res) => {
  const { packId } = req.valid.params as z.infer<typeof PackParams>;
  send(res, api.CollectResponse, await collectPack(req.user!.id, packId));
});

// ---------- Daily ----------
gameRoutes.get("/daily", async (req, res) => {
  send(res, api.Daily, await daily.getDaily(req.user!));
});

gameRoutes.post(
  "/daily/:day/answers",
  rateLimit("daily_answers", 10, "1d"),
  validate({ params: DayParams, body: api.DailyAnswerInput }),
  async (req, res) => {
    const { day } = req.valid.params as z.infer<typeof DayParams>;
    const { idx, word } = req.valid.body as z.infer<typeof api.DailyAnswerInput>;
    send(res, api.DailyAnswerResult, await daily.answerDaily(req.user!, day, idx, word));
  },
);

gameRoutes.get("/daily/:day/share", validate({ params: DayParams }), async (req, res) => {
  const { day } = req.valid.params as z.infer<typeof DayParams>;
  send(res, api.DailyShare, await daily.shareText(req.user!, day));
});

// ---------- Wallet ----------
gameRoutes.get("/wallet", async (req, res) => {
  send(res, api.Wallet, await wallet.getWallet(req.user!.id));
});

gameRoutes.get("/wallet/ledger", validate({ query: LedgerQuery }), async (req, res) => {
  const { cursor, limit } = req.valid.query as z.infer<typeof LedgerQuery>;
  send(res, api.LedgerPage, await wallet.ledgerPage(req.user!.id, cursor, limit));
});

gameRoutes.get("/wallet/payouts", async (req, res) => {
  send(res, api.PayoutList, await wallet.listPayouts(req.user!.id));
});

gameRoutes.post("/wallet/payouts", requireFreshSession(), rateLimit("payouts", 3, "1d"), validate({ body: api.PayoutInput }), async (req, res) => {
  const { amountPaise, upi } = req.valid.body as z.infer<typeof api.PayoutInput>;
  send(res, api.PayoutCreated, await wallet.requestPayout(req.user!.id, amountPaise, upi), 201);
});

// ---------- Map & leaderboard ----------
gameRoutes.get("/map", async (req, res) => {
  send(res, api.MapResponse, await getMap(req.user!.id));
});

// ---------- Pinch Notes (D48) ----------
gameRoutes.get("/notes", async (req, res) => {
  send(res, api.NotesResponse, await notes.inbox(req.user!.id));
});

gameRoutes.post("/notes", rateLimit("notes", 60, "1h"), validate({ body: api.SendNoteInput }), async (req, res) => {
  const { attemptId, kind } = req.valid.body as z.infer<typeof api.SendNoteInput>;
  await notes.sendNote(req.user!.id, attemptId, kind);
  send(res, api.NoteSent, { ok: true }, 201);
});

gameRoutes.post(
  "/notes/:noteId/reply",
  rateLimit("notes", 60, "1h"),
  validate({ params: api.NoteParams, body: api.ReplyNoteInput }),
  async (req, res) => {
    const { noteId } = req.valid.params as z.infer<typeof api.NoteParams>;
    const { kind } = req.valid.body as z.infer<typeof api.ReplyNoteInput>;
    await notes.replyNote(req.user!.id, noteId, kind);
    send(res, api.NoteSent, { ok: true }, 201);
  },
);

gameRoutes.post("/notes/seen", rateLimit("notes-seen", 120, "1h"), async (req, res) => {
  await notes.markSeen(req.user!.id);
  res.status(204).end();
});

gameRoutes.get("/people", async (req, res) => {
  send(res, api.PeopleResponse, await getPeople(req.user!.id));
});

gameRoutes.get("/leaderboard", validate({ query: api.LeaderboardQuery }), async (req, res) => {
  const { scope } = req.valid.query as z.infer<typeof api.LeaderboardQuery>;
  send(res, api.Leaderboard, await getLeaderboard(req.user!, scope));
});

// ---------- Events (first-party analytics only) ----------
gameRoutes.post("/events", rateLimit("events", 120, "1h"), validate({ body: api.EventInput }), async (req, res) => {
  const { name, props } = req.valid.body as z.infer<typeof api.EventInput>;
  await db.insert(events).values({ userId: req.user!.id, name: name as (typeof EVENT_NAMES)[number], props: props ?? null });
  res.status(204).end();
});
