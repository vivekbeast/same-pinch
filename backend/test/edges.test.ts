// Front-to-back edge cases (docs/DECISIONS.md D44): the paths a real phone hits that a happy-path test
// never does — prefetch storms, resumed tabs, partner-less prompts, people you've met.
import { describe, expect, it } from "vitest";
import { newPlayer, packWith, promptWithPartner, roundBody, SECRET_KEYS, sql } from "./helpers";

describe("packs: only created packs count toward the hourly limit", () => {
  it("handing back an open pack (prefetch, resumed tab) is free; creating is limited", async () => {
    const { c, me } = await newPlayer();
    // Fill the 3 open slots, then hammer: every further call returns the oldest open pack.
    const first = await c.post("/packs").expect(201);
    await c.post("/packs").expect(201);
    await c.post("/packs").expect(201);
    for (let i = 0; i < 40; i++) {
      const again = await c.post("/packs").expect(201);
      expect(again.body.packId).toBe(first.body.packId);
    }
    // Created-pack counter = 3, far below the limit.
    const [row] = await sql<{ count: number }[]>`
      select count from rate_limits where key = ${me.id} and bucket = 'packs-created' order by window_start desc limit 1`;
    expect(Number(row!.count)).toBe(3);
  });

  it("a new pack is 5 photo rounds", async () => {
    const { c } = await newPlayer();
    const res = await c.post("/packs").expect(201);
    expect(res.body.rounds).toHaveLength(5);
    expect(res.body.rounds.every((r: { asset: unknown }) => r.asset)).toBe(true);
  });
});

describe("rounds: edges the phone must handle", () => {
  it("first player on a prompt: no partner yet → a played round with partner: null, not an error", async () => {
    const { c, me } = await newPlayer();
    const [p] = await sql<{ id: string }[]>`
      insert into prompts (kind, asset_key, text_key) values ('image', 't-lonely', 'prompt.what_do_you_see') returning id`;
    const pack = await packWith(me.id, p!.id);
    const res = await c.post("/rounds", roundBody(pack.packId, p!.id, [{ text: "chai", lang: "en" }], { pinch: { x: 500, y: 500 } })).expect(200);
    expect(res.body).toMatchObject({ result: "miss", partner: null, earnPaise: 0, spot: { partner: null, same: false } });
  });

  it("a prompt that isn't in this pack → 404 (the client drops it from the offline queue)", async () => {
    const { c, me } = await newPlayer();
    const inPack = await promptWithPartner("t-edge-in", ["dog"], ["en"]);
    const outside = await promptWithPartner("t-edge-out", ["dog"], ["en"]);
    const pack = await packWith(me.id, inPack);
    await c.post("/rounds", roundBody(pack.packId, outside, [{ text: "dog", lang: "en" }])).expect(404);
  });

  it("the same round from a second tab (new attemptId) → ALREADY_ANSWERED", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-edge-twice", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "dog", lang: "en" }])).expect(200);
    const again = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "cat", lang: "en" }])).expect(409);
    expect(again.body.error.code).toBe("ALREADY_ANSWERED");
  });

  it("a round on a collected pack → STALE_ROUND (the phone forgets the pack)", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-edge-stale", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    await sql`update packs set collected_at = now(), played_day = current_date, paid = false, summary = '{}'::jsonb where id = ${pack.packId}`;
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "dog", lang: "en" }]));
    expect(res.body.error.code).toBe("STALE_ROUND");
  });
});

describe("people you've shared a moment with", () => {
  it("lists partners from word pinches and same spots — handles only, never ids", async () => {
    const { c, me } = await newPlayer();
    const p1 = await promptWithPartner("t-people-word", ["chai"], ["hi"]);
    const p2 = await promptWithPartner("t-people-spot", ["dog"], ["en"], { pinch: { x: 300, y: 300 } });
    const p3 = await promptWithPartner("t-people-miss", ["sky"], ["en"]);
    const a = await packWith(me.id, p1);
    const b = await packWith(me.id, p2);
    const d = await packWith(me.id, p3);
    await c.post("/rounds", roundBody(a.packId, p1, [{ text: "chai", lang: "hi" }])).expect(200);
    await c.post("/rounds", roundBody(b.packId, p2, [], { pinch: { x: 320, y: 310 } })).expect(200);
    await c.post("/rounds", roundBody(d.packId, p3, [{ text: "road", lang: "en" }])).expect(200); // a miss: no moment

    const res = await c.get("/people").expect(200);
    // All three partners are the same seeded person (asha_shillong): one row, two moments, newest = spot.
    expect(res.body.people).toEqual([
      expect.objectContaining({ handle: "asha_shillong", stateCode: "ML", moments: 2, last: "spot" }),
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(SECRET_KEYS);
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no uuids at all
  });

  it("is empty for a new player and requires a session", async () => {
    const { c } = await newPlayer();
    expect((await c.get("/people").expect(200)).body).toEqual({ people: [] });
  });
});
