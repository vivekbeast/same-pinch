// Pinch Notes (docs/DECISIONS.md D48): preset notes between partners, one per round, one reply per note.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { newPlayer, packWith, promptWithPartner, roundBody, SECRET_KEYS, sql } from "./helpers";

afterAll(() => sql.end());

describe("pinch notes", () => {
  it("two real players: B notes A after a round, A replies once; ids never leak", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const [p] = await sql<{ id: string }[]>`
      insert into prompts (kind, asset_key, text_key) values ('image', ${`t-note-${randomUUID().slice(0, 8)}`}, 'prompt.what_do_you_see') returning id`;
    // A answers first: A's answer becomes the only recorded partner for this prompt.
    const packA = await packWith(a.me.id, p!.id);
    await a.c.post("/rounds", roundBody(packA.packId, p!.id, [{ text: "chai", lang: "en" }])).expect(200);
    // B plays the same prompt and is paired with A.
    const packB = await packWith(b.me.id, p!.id);
    const bRound = roundBody(packB.packId, p!.id, [{ text: "chai", lang: "en" }]);
    const res = await b.c.post("/rounds", bRound).expect(200);
    expect(res.body.partner.handle).toBe(a.me.handle);

    await b.c.post("/notes", { attemptId: bRound.attemptId, kind: "same_brain" }).expect(201);
    await b.c.post("/notes", { attemptId: bRound.attemptId, kind: "hello" }).expect(409); // one per round

    const inboxA = await a.c.get("/notes").expect(200);
    expect(inboxA.body).toMatchObject({ unread: 1, notes: [{ from: { handle: b.me.handle }, kind: "same_brain", canReply: true, isReply: false }] });
    expect(JSON.stringify(inboxA.body)).not.toMatch(SECRET_KEYS);
    expect(JSON.stringify(inboxA.body)).not.toContain(b.me.id);

    const noteId = inboxA.body.notes[0].id;
    await a.c.post(`/notes/${noteId}/reply`, { kind: "haha_same" }).expect(201);
    await a.c.post(`/notes/${noteId}/reply`, { kind: "thanks" }).expect(409); // one reply
    expect((await a.c.get("/notes").expect(200)).body.notes[0].canReply).toBe(false);

    const inboxB = await b.c.get("/notes").expect(200);
    expect(inboxB.body.notes[0]).toMatchObject({ from: { handle: a.me.handle }, kind: "haha_same", isReply: true, canReply: false });
    // A reply is the end of the thread.
    await b.c.post(`/notes/${inboxB.body.notes[0].id}/reply`, { kind: "hello" }).expect(403);

    await a.c.post("/notes/seen").expect(204);
    expect((await a.c.get("/notes").expect(200)).body.unread).toBe(0);
  });

  it("demo mode: a seeded partner replies straight away", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-note-seed", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    const body = roundBody(pack.packId, promptId, [{ text: "dog", lang: "en" }]);
    await c.post("/rounds", body).expect(200);
    await c.post("/notes", { attemptId: body.attemptId, kind: "hello" }).expect(201);
    const inbox = await c.get("/notes").expect(200);
    expect(inbox.body.notes).toEqual([expect.objectContaining({ from: expect.objectContaining({ handle: "asha_shillong" }), isReply: true })]);
  });

  it("refuses notes to nobody, on someone else's round, and unknown kinds", async () => {
    const { c, me } = await newPlayer();
    const other = await newPlayer();
    const [lonely] = await sql<{ id: string }[]>`
      insert into prompts (kind, asset_key, text_key) values ('image', 't-note-lonely', 'prompt.what_do_you_see') returning id`;
    const pack = await packWith(me.id, lonely!.id);
    const body = roundBody(pack.packId, lonely!.id, [{ text: "sky", lang: "en" }]);
    await c.post("/rounds", body).expect(200); // first player: no partner
    await c.post("/notes", { attemptId: body.attemptId, kind: "hello" }).expect(404);
    await other.c.post("/notes", { attemptId: body.attemptId, kind: "hello" }).expect(404); // not their round
    await c.post("/notes", { attemptId: body.attemptId, kind: "call me 98xxxx" }).expect(422); // presets only
    await c.post("/notes", { attemptId: randomUUID(), kind: "hello" }).expect(404);
  });
});
