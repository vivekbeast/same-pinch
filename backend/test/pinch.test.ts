// Pinch the Picture (docs/DECISIONS.md D39): pinch a spot on the photo; naming it is optional. Same spot
// earns XP, never ₹; money stays tied to words matched by meaning. The client never decides either.
import { describe, expect, it } from "vitest";
import { client, newPlayer, packWith, promptWithPartner, roundBody, SECRET_KEYS, sql } from "./helpers";

describe("pinch the picture", () => {
  it("same spot: the partner's pinch is revealed after yours is stored, +spot XP, no ₹ without words", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-pinch-same", ["chai"], ["hi"], { pinch: { x: 700, y: 480 } });
    const pack = await packWith(me.id, promptId);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [], { pinch: { x: 760, y: 520 } })).expect(200);
    expect(res.body).toMatchObject({
      result: "miss", // no words → no word match
      earnPaise: 0,
      xp: 1 + 6, // miss + same-spot bonus
      spot: { you: { x: 760, y: 520 }, partner: { x: 700, y: 480 }, same: true },
      partner: { words: [{ text: "chai", matched: false }] },
    });
    expect(JSON.stringify(res.body)).not.toMatch(SECRET_KEYS);
    const [row] = await sql`select pinch_x, pinch_y, spot_match from answers where user_id = ${me.id} and prompt_id = ${promptId}`;
    expect(row).toMatchObject({ pinch_x: 760, pinch_y: 520, spot_match: true });
  });

  it("different spot + matching words: the word pinch pays, the spot doesn't add XP", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-pinch-diff", ["chai"], ["hi"], { pinch: { x: 100, y: 100 } });
    const pack = await packWith(me.id, promptId);
    const res = await c
      .post("/rounds", roundBody(pack.packId, promptId, [{ text: "chai", lang: "hi" }], { pinch: { x: 900, y: 900 } }))
      .expect(200);
    expect(res.body).toMatchObject({ result: "exact", xp: 10, spot: { same: false } });
    expect(res.body.earnPaise).toBeGreaterThan(0);
  });

  it("a partner who never pinched: spot.partner is null and same is false", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-pinch-none", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [], { pinch: { x: 500, y: 500 } })).expect(200);
    expect(res.body.spot).toEqual({ you: { x: 500, y: 500 }, partner: null, same: false });
    expect(res.body.result).not.toBe("skipped");
  });

  it("a pinch on a question round is rejected; no words and no pinch is still a skip", async () => {
    const { c, me } = await newPlayer();
    const q = await promptWithPartner("t_pinch_question", ["rain"], ["en"], { question: true });
    const pack = await packWith(me.id, q);
    await c.post("/rounds", roundBody(pack.packId, q, [], { pinch: { x: 10, y: 10 } })).expect(422);
    const skip = await c.post("/rounds", roundBody(pack.packId, q, [])).expect(200);
    expect(skip.body).toMatchObject({ result: "skipped", xp: 0, spot: null });
  });

  it("validates the grid: 0–1000 integers only", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-pinch-grid", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    await c.post("/rounds", roundBody(pack.packId, promptId, [], { pinch: { x: 1001, y: 5 } })).expect(422);
    await c.post("/rounds", roundBody(pack.packId, promptId, [], { pinch: { x: 0.5, y: 5 } })).expect(422);
  });

  it("an idempotent replay returns the same spot", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-pinch-replay", ["dog"], ["en"], { pinch: { x: 400, y: 400 } });
    const pack = await packWith(me.id, promptId);
    const body = roundBody(pack.packId, promptId, [], { pinch: { x: 420, y: 410 } });
    const a = await c.post("/rounds", body).expect(200);
    const b = await c.post("/rounds", body).expect(200);
    expect(b.body.spot).toEqual(a.body.spot);
  });
});

describe("smart chips word list (SECURITY T17)", () => {
  it("serves plain words per language — no concept ids — and supports ETag", async () => {
    const c = client();
    const res = await c.get("/words").expect(200);
    expect(res.headers["cache-control"]).toMatch(/public/);
    expect(res.body.words.en).toContain("chai");
    expect(res.body.words.hi).toContain("चाय");
    expect(JSON.stringify(res.body)).not.toMatch(/c_[a-z]/); // concept ids never leave the server
    await c.get("/words").set("If-None-Match", String(res.headers.etag)).expect(304);
  });
});
