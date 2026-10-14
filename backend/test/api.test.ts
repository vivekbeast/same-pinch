// End-to-end API tests against a real (test) Postgres: every rule the docs promise, through HTTP.
import { afterAll, describe, expect, it } from "vitest";
import { BADGE_IDS, TERMS_VERSION } from "@shared";
import { clearConfigCache } from "../src/services/config.service";
import { client, linkGoogle, newPlayer, packWith, playPack, promptWithPartner, roundBody, SECRET_KEYS, SIGNUP, sql } from "./helpers";

afterAll(() => sql.end());

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

describe("system", () => {
  it("health reports the database", async () => {
    const res = await client().get("/health").expect(200);
    expect(res.body).toMatchObject({ ok: true, db: "up" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("serves public config", async () => {
    const res = await client().get("/config").expect(200);
    expect(res.body).toMatchObject({ paidEnabled: true, demoMode: true, minPayoutPaise: 5000, paidPacksPerDay: 5 });
  });

  it("unknown routes → NOT_FOUND in the standard error shape", async () => {
    const res = await client().get("/nope").expect(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", requestId: expect.any(String) } });
  });

  it("malformed JSON → 422, never a stack trace", async () => {
    const c = client();
    const res = await c.raw
      .post("/api/v1/auth/anon")
      .set("Origin", "http://localhost:5173")
      .set("X-SP-Client", "web")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(422);
    expect(res.body.error.code).toBe("INVALID_INPUT");
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack|SyntaxError/);
  });
});

describe("CSRF origin guard (SECURITY T11)", () => {
  it("rejects non-GET without X-SP-Client", async () => {
    const c = client();
    const res = await c.raw.post("/api/v1/auth/anon").set("Origin", "http://localhost:5173").send({ uiLang: "en", ageConfirmed: true });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects a foreign Origin", async () => {
    const c = client();
    const res = await c.raw.post("/api/v1/auth/anon").set("Origin", "https://evil.example").set("X-SP-Client", "web").send({ uiLang: "en", ageConfirmed: true });
    expect(res.status).toBe(403);
  });
});

describe("auth & sessions", () => {
  it("anonymous start: HttpOnly cookie, generated handle, restore code shown once", async () => {
    const c = client();
    const res = await c.post("/auth/anon", { ...SIGNUP, uiLang: "kn" }).expect(201);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/sp_sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.user).toMatchObject({ uiLang: "kn", stateCode: "KA", city: "Mysuru", xp: 0, level: { value: 1 }, flame: { value: 0 }, balancePaise: 0, paidPacksLeftToday: 5 });
    expect(res.body.user.handle).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(res.body.user.restoreCode).toMatch(/^[23456789A-HJ-NP-Z]{8}$/);

    const me = await c.get("/me").expect(200);
    expect(me.body.user.id).toBe(res.body.user.id);
    expect(me.body.user.restoreCode).toBeNull(); // never again on GET /me
  });

  it("requires 18+, accepted terms and a valid state; records the terms version (D45)", async () => {
    await client().post("/auth/anon", { ...SIGNUP, ageConfirmed: false }).expect(422);
    await client().post("/auth/anon", { ...SIGNUP, termsAccepted: false }).expect(422);
    const { termsAccepted: _t, ...noTerms } = SIGNUP;
    await client().post("/auth/anon", noTerms).expect(422);
    const { stateCode: _s, ...noState } = SIGNUP;
    await client().post("/auth/anon", noState).expect(422);
    await client().post("/auth/anon", { ...SIGNUP, stateCode: "XX" }).expect(422);
    // City is optional.
    const { city: _c, ...noCity } = SIGNUP;
    const ok = await client().post("/auth/anon", noCity).expect(201);
    const [row] = await sql<{ terms_version: string; terms_accepted_at: Date }[]>`
      select terms_version, terms_accepted_at from users where id = ${ok.body.user.id}`;
    expect(row!.terms_version).toBe(TERMS_VERSION);
    expect(row!.terms_accepted_at).toBeTruthy();
  });

  it("unauthenticated → 401", async () => {
    const res = await client().get("/me").expect(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("restore moves the account to a new device and rotates the code", async () => {
    const { me } = await newPlayer();
    const phone2 = client();
    const res = await phone2.post("/auth/restore", { code: me.restoreCode.toLowerCase() }).expect(200);
    expect(res.body.user.id).toBe(me.id);
    expect(res.body.user.restoreCode).not.toBe(me.restoreCode);
    await client().post("/auth/restore", { code: me.restoreCode }).expect(404); // old code is dead
  });

  it("rate-limits restore attempts per IP with Retry-After (SECURITY T14)", async () => {
    const c = client();
    for (let i = 0; i < 5; i++) await c.post("/auth/restore", { code: "ZZZZZZZZ" }).expect(404);
    const res = await c.post("/auth/restore", { code: "ZZZZZZZZ" }).expect(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("logout ends the session immediately", async () => {
    const { c } = await newPlayer();
    await c.post("/auth/logout").expect(204);
    await c.get("/me").expect(401);
  });

  it("logout-all revokes every device", async () => {
    const { c, me } = await newPlayer();
    const other = client();
    await other.post("/auth/restore", { code: me.restoreCode }).expect(200);
    await c.post("/auth/logout-all").expect(204);
    await other.get("/me").expect(401);
  });

  it("demo login keeps its public code", async () => {
    const c = client();
    const res = await c.post("/auth/demo").expect(200);
    expect(res.body.user).toMatchObject({ handle: "ritika_demo", restoreCode: "SAME7777", flame: { best: 7, freezes: 1 } });
    await client().post("/auth/restore", { code: "SAME7777" }).expect(200);
    await client().post("/auth/restore", { code: "SAME7777" }).expect(200); // still valid
  });

  it("rotating the restore code from Settings invalidates the old one", async () => {
    const { c, me } = await newPlayer();
    const res = await c.post("/auth/restore-code").expect(200);
    expect(res.body.code).not.toBe(me.restoreCode);
    await client().post("/auth/restore", { code: me.restoreCode }).expect(404);
  });
});

describe("profile", () => {
  it("patches profile and merges settings", async () => {
    const { c } = await newPlayer();
    const res = await c.patch("/me", { stateCode: "KA", city: "Hubballi", settings: { moreTime: true } }).expect(200);
    expect(res.body.user).toMatchObject({ stateCode: "KA", city: "Hubballi", settings: { moreTime: true } });
    const res2 = await c.patch("/me", { settings: { sound: false } }).expect(200);
    expect(res2.body.user.settings).toMatchObject({ moreTime: true, sound: false });
  });

  it("rejects a taken handle and an invalid timezone", async () => {
    const { c } = await newPlayer();
    const taken = await c.patch("/me", { handle: "ritika_demo" }).expect(409);
    expect(taken.body.error.code).toBe("HANDLE_TAKEN");
    await c.patch("/me", { tz: "Mars/Olympus" }).expect(422);
    await c.patch("/me", { handle: "Bad Handle!" }).expect(422);
  });

  it("lists badges", async () => {
    const { c } = await newPlayer();
    const res = await c.get("/me/badges").expect(200);
    expect(res.body.all).toHaveLength(BADGE_IDS.length);
    expect(res.body.earned).toEqual([]);
  });
});

describe("packs & rounds", () => {
  it("builds a 5-round all-photo pack with no gold or partner data (SECURITY T1/T2, D40)", async () => {
    const { c } = await newPlayer();
    const res = await c.post("/packs").expect(201);
    expect(res.body.rounds).toHaveLength(5);
    // Every round is a photo: 4 pinch (incl. the hidden gold) + 1 vibe; questions live in Daily.
    expect(res.body.rounds.every((r: { asset: unknown }) => r.asset)).toBe(true);
    expect(res.body.rounds.filter((r: { kind: string }) => r.kind === "image")).toHaveLength(4);
    expect(res.body.answered).toEqual([]);
    expect(new Set(res.body.rounds.map((r: { promptId: string }) => r.promptId)).size).toBe(5);
    expect(res.body.rounds.filter((r: { kind: string }) => r.kind === "vibe")).toHaveLength(1);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(SECRET_KEYS);
    expect(raw).not.toMatch(/partner|words/);
    const img = res.body.rounds.find((r: { kind: string }) => r.kind === "image");
    expect(img.asset.src).toMatch(/^\/prompts\/[a-z0-9-]+-480\.webp$/);
  });

  it("scores a Bhasha pinch: naayi (kn) = kutta (hi) → +₹0.98 for a new player (×1.3)", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-bhasha", ["kutta", "road"], ["hi", "en"]);
    const pack = await packWith(me.id, promptId);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "Naayi", lang: "kn" }])).expect(200);
    expect(res.body).toMatchObject({
      result: "bhasha",
      you: [{ text: "naayi", lang: "kn", matched: true, burnt: false }],
      partner: { handle: "asha_shillong", stateCode: "ML", words: [{ text: "kutta", matched: true }, { text: "road", matched: false }] },
      xp: 15,
      earnPaise: 98,
      newRegion: "ML",
    });
    expect(JSON.stringify(res.body)).not.toMatch(SECRET_KEYS);
  });

  it("detects language from script: ನಾಯಿ typed with an English plate still counts as Kannada", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-script", ["dog"], ["en"]);
    const pack = await packWith(me.id, promptId);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "ನಾಯಿ", lang: "en" }])).expect(200);
    expect(res.body.result).toBe("bhasha");
    expect(res.body.you[0].lang).toBe("kn");
  });

  it("exact pinch, near pinch, miss and low-info words", async () => {
    const { c, me } = await newPlayer();
    const p1 = await promptWithPartner("t-exact", ["chai"], ["hi"]);
    const p2 = await promptWithPartner("t-near", ["dog"], ["en"]);
    const p3 = await promptWithPartner("t-miss", ["nice"], ["en"]);
    const packA = await packWith(me.id, p1);
    const packB = await packWith(me.id, p2);
    const packC = await packWith(me.id, p3);
    const exact = await c.post("/rounds", roundBody(packA.packId, p1, [{ text: "chai", lang: "hi" }])).expect(200);
    expect(exact.body).toMatchObject({ result: "exact", xp: 10, earnPaise: 65 });
    const near = await c.post("/rounds", roundBody(packB.packId, p2, [{ text: "puppy", lang: "en" }])).expect(200);
    expect(near.body).toMatchObject({ result: "near", xp: 4, earnPaise: 0 });
    const miss = await c.post("/rounds", roundBody(packC.packId, p3, [{ text: "nice", lang: "en" }])).expect(200);
    expect(miss.body).toMatchObject({ result: "miss", earnPaise: 0 }); // "nice" is low-information on both sides
  });

  it("burnt words are flagged and never match (GAME_DESIGN §5)", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-burnt", ["dog"], ["en"], { burnt: ["c_dog"] });
    const pack = await packWith(me.id, promptId);
    const g = await c.get(`/packs/${pack.packId}`).expect(200);
    expect(g.body.rounds[0].burnt).toEqual(["dog"]);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "kutta", lang: "hi" }])).expect(200);
    expect(res.body.result).toBe("miss");
    expect(res.body.you[0]).toMatchObject({ text: "kutta", burnt: true, matched: false });
  });

  it("gold rounds look and pay like normal rounds; the verdict stays server-side (D22)", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-gold", ["cat"], ["en"], { gold: ["c_cat"] });
    const pack = await packWith(me.id, promptId);
    const res = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "billi", lang: "hi" }])).expect(200);
    expect(res.body).toMatchObject({ result: "bhasha", earnPaise: 98 });
    expect(JSON.stringify(res.body)).not.toMatch(SECRET_KEYS);
    const [row] = await sql`select gold_correct from answers where user_id = ${me.id} and prompt_id = ${promptId}`;
    expect(row!.gold_correct).toBe(true);
    const [u] = await sql`select gold_streak from users where id = ${me.id}`;
    expect(u!.gold_streak).toBe(1);
  });

  it("is idempotent on attemptId and rejects a second answer to the same round (SECURITY T4)", async () => {
    const { c, me } = await newPlayer();
    const promptId = await promptWithPartner("t-idem", ["chai"], ["hi"]);
    const pack = await packWith(me.id, promptId);
    const body = roundBody(pack.packId, promptId, [{ text: "tea", lang: "en" }]);
    const first = await c.post("/rounds", body).expect(200);
    const replay = await c.post("/rounds", body).expect(200);
    expect(replay.body).toEqual({ ...first.body, newRegion: null });
    const dup = await c.post("/rounds", roundBody(pack.packId, promptId, [{ text: "chai", lang: "hi" }])).expect(409);
    expect(dup.body.error.code).toBe("ALREADY_ANSWERED");
    const n = (await sql<{ n: number }[]>`select count(*)::int as n from answers where user_id = ${me.id} and prompt_id = ${promptId}`)[0]!.n;
    expect(n).toBe(1);
  });

  it("an empty submission is a skipped round: no XP, no ₹, no partner reveal", async () => {
    const { c } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    const res = await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [])).expect(200);
    expect(res.body).toEqual({ result: "skipped", you: [], partner: null, xp: 0, earnPaise: 0, newRegion: null, spot: null });
  });

  it("rejects stale or future playedAt (SECURITY T9)", async () => {
    const { c } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    const old = new Date(Date.now() - 49 * 3_600_000).toISOString();
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    expect((await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "chai", lang: "en" }], { playedAt: old })).expect(409)).body.error.code).toBe("STALE_ROUND");
    await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "chai", lang: "en" }], { playedAt: future })).expect(409);
  });

  it("validates input shape", async () => {
    const { c } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    const four = [1, 2, 3, 4].map((i) => ({ text: `w${i}`, lang: "en" }));
    await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, four)).expect(422);
    await c.post("/rounds", { ...roundBody(pack.packId, pack.rounds[0].promptId, []), attemptId: "not-a-uuid" }).expect(422);
    await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "x", lang: "fr" }])).expect(422);
  });

  it("one player can never touch another player's pack (404, not 403)", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    const pack = (await a.c.post("/packs").expect(201)).body;
    await b.c.get(`/packs/${pack.packId}`).expect(404);
    await b.c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "chai", lang: "en" }])).expect(404);
    await b.c.post(`/packs/${pack.packId}/collect`).expect(404);
    // …nor replay their attempt id
    const body = roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "chai", lang: "en" }]);
    await a.c.post("/rounds", body).expect(200);
    await b.c.post("/rounds", body).expect(404);
  });

  it("resumes: GET /packs/:id lists already-answered prompts", async () => {
    const { c } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "chai", lang: "en" }])).expect(200);
    const res = await c.get(`/packs/${pack.packId}`).expect(200);
    expect(res.body.answered).toEqual([pack.rounds[0].promptId]);
  });

  it("caps open packs at 3 by returning the oldest open one", async () => {
    const { c } = await newPlayer();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await c.post("/packs").expect(201)).body.packId);
    const fourth = await c.post("/packs").expect(201);
    expect(fourth.body.packId).toBe(ids[0]);
  });
});

describe("collect", () => {
  it("refuses an incomplete pack", async () => {
    const { c } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    const res = await c.post(`/packs/${pack.packId}/collect`).expect(409);
    expect(res.body.error.code).toBe("PACK_INCOMPLETE");
  });

  it("credits the ledger, starts the flame, levels XP — and is idempotent", async () => {
    const { c, me } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    const results = await playPack(c, pack);
    const earned = results.reduce((a: number, r: { earnPaise: number }) => a + r.earnPaise, 0);
    const xp = results.reduce((a: number, r: { xp: number }) => a + r.xp, 0) + 20;

    const res = await c.post(`/packs/${pack.packId}/collect`).expect(200);
    expect(res.body).toMatchObject({
      earnedPaise: earned,
      paid: true,
      xpGained: xp,
      xpTotal: xp,
      flame: { value: 1, increased: true, freezeUsed: false },
    });
    expect(res.body.ledgerStatus).toBe(earned > 0 ? "credited" : null);

    const again = await c.post(`/packs/${pack.packId}/collect`).expect(200);
    expect(again.body).toEqual(res.body);

    const meRes = await c.get("/me").expect(200);
    expect(meRes.body.user).toMatchObject({ balancePaise: earned, xp, flame: { value: 1, safeToday: true }, paidPacksLeftToday: 4 });
    const n = (await sql<{ n: number }[]>`select count(*)::int as n from ledger where user_id = ${me.id} and kind = 'earn'`)[0]!.n;
    expect(n).toBe(earned > 0 ? 1 : 0);

    // a collected pack accepts no more rounds
    await c.post("/rounds", roundBody(pack.packId, pack.rounds[0].promptId, [{ text: "x", lang: "en" }])).expect(409);
  });

  it("after 5 paid packs today, further packs are XP-only (daily cap, D5)", async () => {
    const { c, me } = await newPlayer();
    await sql`insert into user_days (user_id, day, packs, paid_packs) values (${me.id}, ${today()}, 5, 5)`;
    const promptId = await promptWithPartner("t-cap", ["chai"], ["hi"]);
    const pack = await packWith(me.id, promptId);
    const results = await playPack(c, pack, [{ text: "chai", lang: "hi" }]);
    expect(results[0].earnPaise).toBe(65); // provisional per round…
    const res = await c.post(`/packs/${pack.packId}/collect`).expect(200);
    expect(res.body).toMatchObject({ paid: false, earnedPaise: 0, ledgerStatus: null }); // …but nothing credited
    expect(res.body.xpGained).toBeGreaterThan(0);
  });

  it("holds bot-like packs for review instead of crediting (SECURITY T5)", async () => {
    const { c } = await newPlayer();
    const promptId = await promptWithPartner("t-bot", ["chai"], ["hi"]);
    const me = (await c.get("/me")).body.user;
    const pack = await packWith(me.id, promptId);
    for (const r of pack.rounds) {
      await c.post("/rounds", roundBody(pack.packId, r.promptId, [{ text: "chai", lang: "hi" }], { responseMs: 300 })).expect(200);
    }
    const res = await c.post(`/packs/${pack.packId}/collect`).expect(200);
    if (res.body.earnedPaise > 0) expect(res.body.ledgerStatus).toBe("pending_review");
    const meRes = await c.get("/me").expect(200);
    expect(meRes.body.user.balancePaise).toBe(0); // held money is not spendable
  });

  it("a freeze covers a missed day; without one the flame restarts", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const d2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(twoDaysAgo);

    const a = await newPlayer();
    await sql`update users set flame = 4, flame_best = 4, freezes = 1, last_play_day = ${d2} where id = ${a.me.id}`;
    const packA = (await a.c.post("/packs").expect(201)).body;
    await playPack(a.c, packA);
    const resA = await a.c.post(`/packs/${packA.packId}/collect`).expect(200);
    expect(resA.body.flame).toMatchObject({ value: 5, freezeUsed: true, freezes: 0 });

    const b = await newPlayer();
    await sql`update users set flame = 4, flame_best = 4, freezes = 0, last_play_day = ${d2} where id = ${b.me.id}`;
    expect((await b.c.get("/me")).body.user.flame.value).toBe(0); // shown as broken before playing
    const packB = (await b.c.post("/packs").expect(201)).body;
    await playPack(b.c, packB);
    const resB = await b.c.post(`/packs/${packB.packId}/collect`).expect(200);
    expect(resB.body.flame).toMatchObject({ value: 1 });
    expect((await b.c.get("/me")).body.user.flame.best).toBe(4);
  });
});

describe("wallet & payouts", () => {
  async function richPlayer(paise: number) {
    const p = await newPlayer();
    await linkGoogle(p.c); // stage 3: payouts need a linked, verified identity
    await sql`insert into ledger (user_id, kind, amount_paise, status, note) values (${p.me.id}, 'adjustment', ${paise}, 'credited', 'test credit')`;
    return p;
  }

  it("enforces the ₹50 minimum and the balance (SECURITY §8)", async () => {
    const { c } = await richPlayer(6_000);
    expect((await c.post("/wallet/payouts", { amountPaise: 4_999, upi: "vivek.t@okaxis" }).expect(409)).body.error.code).toBe("MIN_PAYOUT");
    expect((await c.post("/wallet/payouts", { amountPaise: 9_000, upi: "vivek.t@okaxis" }).expect(409)).body.error.code).toBe("INSUFFICIENT_BALANCE");
    await c.post("/wallet/payouts", { amountPaise: 5_000, upi: "not a upi" }).expect(422);
  });

  it("reserves money while pending and settles the demo payout lazily", async () => {
    const { c } = await richPlayer(6_000);
    const res = await c.post("/wallet/payouts", { amountPaise: 5_000, upi: "vivek.t@okaxis" }).expect(201);
    expect(res.body.payout).toMatchObject({ amountPaise: 5_000, upiMasked: "v***@okaxis", status: "pending" });
    let w = await c.get("/wallet").expect(200);
    expect(w.body).toMatchObject({ balancePaise: 1_000, pendingPaise: 5_000, paidPaise: 0 });

    // can't double-spend the reserved money
    await c.post("/wallet/payouts", { amountPaise: 5_000, upi: "vivek.t@okaxis" }).expect(409);

    // payouts are immutable (guard trigger), so shorten the demo settle delay instead of back-dating
    await sql`insert into game_config (key, value) values ('payout', '{"demoSettleSeconds": 0}') on conflict (key) do update set value = excluded.value`;
    clearConfigCache();
    w = await c.get("/wallet").expect(200);
    await sql`update game_config set value = ${sql.json({ minPaise: 5000, perDay: 3, demoSettleSeconds: 60 })} where key = 'payout'`;
    clearConfigCache();
    expect(w.body).toMatchObject({ balancePaise: 1_000, pendingPaise: 0, paidPaise: 5_000 });
    const list = await c.get("/wallet/payouts").expect(200);
    expect(list.body.items[0]).toMatchObject({ status: "paid" });
    expect(JSON.stringify(list.body)).not.toMatch(/vivek\.t/); // full UPI never stored
  });

  it("pages the ledger newest first", async () => {
    const res = await client().post("/auth/demo").expect(200);
    expect(res.body.user.handle).toBe("ritika_demo");
    const c = client();
    await c.post("/auth/demo").expect(200);
    const p1 = await c.get("/wallet/ledger?limit=5").expect(200);
    expect(p1.body.items).toHaveLength(5);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await c.get(`/wallet/ledger?limit=5&cursor=${p1.body.nextCursor}`).expect(200);
    expect(p2.body.items[0].id).toBeLessThan(p1.body.items[4].id);
  });
});

describe("daily — Think Like India", () => {
  it("serves today's 5 prompts, grades once per prompt, shares a grid", async () => {
    const { c } = await newPlayer();
    const d = await c.get("/daily").expect(200);
    expect(d.body.prompts).toHaveLength(5);
    expect(d.body.number).toBeGreaterThan(0);
    expect(JSON.stringify(d.body)).not.toMatch(SECRET_KEYS);

    const ans = await c.post(`/daily/${d.body.day}/answers`, { idx: 0, word: { text: "chai", lang: "en" } }).expect(200);
    expect(["top", "top5", "none"]).toContain(ans.body.grade);
    expect(ans.body.india).toMatchObject({ text: expect.any(String), pct: expect.any(Number) });
    expect((await c.post(`/daily/${d.body.day}/answers`, { idx: 0, word: { text: "tea", lang: "en" } }).expect(409)).body.error.code).toBe("ALREADY_ANSWERED");

    const again = await c.get("/daily").expect(200);
    expect(again.body.answers).toHaveLength(1);
    expect(again.body.prompts.map((p: { promptId: string }) => p.promptId)).toEqual(d.body.prompts.map((p: { promptId: string }) => p.promptId));

    const share = await c.get(`/daily/${d.body.day}/share`).expect(200);
    expect(share.body.text).toMatch(new RegExp(`^Same Pinch #${d.body.number} 🤏\\n[🟩🟨⬜]{5}  \\d/5\\nsamepinch\\.vercel\\.app$`, "u"));
  });

  it("only accepts today's challenge", async () => {
    const { c } = await newPlayer();
    await c.post("/daily/2026-01-01/answers", { idx: 0, word: { text: "chai", lang: "en" } }).expect(409);
  });
});

describe("map, leaderboard, events", () => {
  it("map lists synced regions out of 36", async () => {
    const c = client();
    await c.post("/auth/demo").expect(200);
    const res = await c.get("/map").expect(200);
    expect(res.body.total).toBe(36);
    expect(res.body.synced.length).toBeGreaterThan(5);
  });

  it("leaderboard ranks weekly XP with no user ids", async () => {
    const c = client();
    await c.post("/auth/demo").expect(200);
    const res = await c.get("/leaderboard?scope=india").expect(200);
    expect(res.body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(JSON.stringify(res.body)).not.toMatch(/"id"|userId|user_id/);
    const { city: _city, ...noCity } = SIGNUP; // city is optional at sign-up (D45)
    const noCityPlayer = client();
    await noCityPlayer.post("/auth/anon", noCity).expect(201);
    const city = await noCityPlayer.get("/leaderboard?scope=city").expect(200);
    expect(city.body).toMatchObject({ me: null, top: [] }); // no city set
    await c.get("/leaderboard?scope=galaxy").expect(422);
  });

  it("accepts whitelisted events only", async () => {
    const { c } = await newPlayer();
    await c.post("/events", { name: "app_open", props: { v: 1 } }).expect(204);
    await c.post("/events", { name: "hack" }).expect(422);
  });
});

describe("account deletion (DPDP)", () => {
  it("deletes the profile and money, keeps answers anonymised", async () => {
    const { c, me } = await newPlayer();
    const pack = (await c.post("/packs").expect(201)).body;
    await playPack(c, pack);
    await c.post(`/packs/${pack.packId}/collect`).expect(200);
    await c.del("/me").expect(204);
    await c.get("/me").expect(401);
    const users = (await sql<{ users: number }[]>`select count(*)::int as users from users where id = ${me.id}`)[0]!.users;
    const ledger = (await sql<{ ledger: number }[]>`select count(*)::int as ledger from ledger where user_id = ${me.id}`)[0]!.ledger;
    const anon = (await sql<{ anon: number }[]>`select count(*)::int as anon from answers where id in (select id from answers where user_id is null) and played_at > now() - interval '1 minute'`)[0]!.anon;
    expect(users).toBe(0);
    expect(ledger).toBe(0);
    expect(anon).toBeGreaterThanOrEqual(pack.rounds.length); // one anonymised answer per round played
  });
});

describe("jobs", () => {
  it("prune requires the bearer secret", async () => {
    const c = client();
    await c.raw.post("/api/v1/jobs/prune").expect(403);
    const res = await c.raw.post("/api/v1/jobs/prune").set("Authorization", `Bearer ${process.env.JOBS_SECRET}`).expect(200);
    expect(res.body).toMatchObject({ events: expect.any(Number), rateLimits: expect.any(Number), sessions: expect.any(Number) });
  });
});
