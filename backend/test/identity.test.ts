// Stage 2 (secure the account with Google) and stage 3 (payouts only after verification), end to end
// through the real redirect flow. Google's token endpoint is faked in helpers.ts (no network).
import { afterAll, describe, expect, it } from "vitest";
import { clearConfigCache } from "../src/services/config.service";
import { client, googleFlow, linkGoogle, newPlayer, sql } from "./helpers";

afterAll(() => sql.end());

const params = (url: string) => new URL(url).searchParams;

describe("Google sign-in plumbing", () => {
  it("config advertises Google; payouts simulated", async () => {
    const res = await client().get("/config").expect(200);
    expect(res.body.linking).toEqual({ google: true });
    expect(res.body.payoutMode).toBe("simulated");
  });

  it("start redirects to Google with PKCE, state and nonce — never the secret", async () => {
    const c = client();
    const res = await c.get("/auth/google/start?intent=login&returnTo=/").expect(302);
    const url = new URL(res.headers.location as string);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = url.searchParams;
    expect(q.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
    expect(q.get("redirect_uri")).toBe("http://localhost:3000/api/auth/google/callback");
    expect(q.get("response_type")).toBe("code");
    expect(q.get("scope")).toBe("openid email");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(q.get("state")).toMatch(/^[\w-]{43}$/);
    expect(q.get("nonce")).toMatch(/^[\w-]{43}$/);
    expect(res.headers.location).not.toContain("test-client-secret");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/sp_oauth=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

describe("stage 1 → 2: link Google without losing progress", () => {
  it("links to the same account; progress and id unchanged; email masked", async () => {
    const { c, me } = await newPlayer();
    await sql`update users set xp = 321, flame = 4, flame_best = 4 where id = ${me.id}`;
    const { location } = await googleFlow(c, "link", "test|g-link-1|vivek.t@gmail.com", "/settings");
    expect(location).toBe("http://localhost:5173/settings?linked=google");
    const res = await c.get("/me").expect(200);
    expect(res.body.user).toMatchObject({ id: me.id, xp: 321, flame: { best: 4 } });
    expect(res.body.user.identities).toEqual([{ provider: "google", display: "v•••@gmail.com", linkedAt: expect.any(String) }]);
  });

  it("stores Google ids only as keyed hashes", async () => {
    const { c } = await newPlayer();
    await googleFlow(c, "link", "test|g-secret-sub-777|x@example.com");
    const rows = await sql`select row_to_json(t)::text as j from auth_identities t`;
    for (const r of rows) expect(r.j).not.toContain("g-secret-sub-777");
  });

  it("linking needs a signed-in player", async () => {
    const { location } = await googleFlow(client(), "link", "test|g-x|x@example.com");
    expect(params(location).get("auth_error")).toBe("signin_required");
  });

  it("one Google account belongs to one player", async () => {
    const a = await newPlayer();
    const b = await newPlayer();
    await googleFlow(a.c, "link", "test|g-shared|s@example.com");
    const { location } = await googleFlow(b.c, "link", "test|g-shared|s@example.com");
    expect(params(location).get("auth_error")).toBe("identity_taken");
  });

  it("the player who started linking must still be the one signed in", async () => {
    const { c } = await newPlayer();
    const start = await c.get("/auth/google/start?intent=link&returnTo=/settings").expect(302);
    const state = new URL(start.headers.location as string).searchParams.get("state")!;
    await c.post("/auth/logout").expect(204);
    const cb = await c.callback(`?code=${encodeURIComponent("test|g-hijack|h@example.com")}&state=${state}`).expect(302);
    expect(params(cb.headers.location as string).get("auth_error")).toBe("google_failed");
  });
});

describe("stage 2: sign in on a new device with Google", () => {
  it("lands on the same account with a fresh session", async () => {
    const { c, me } = await newPlayer();
    await googleFlow(c, "link", "test|g-login-1|asha@example.com");
    const laptop = client();
    const { location, cb } = await googleFlow(laptop, "login", "test|g-login-1|asha@example.com", "/");
    expect(location).toBe("http://localhost:5173/?signed_in=google");
    expect(String(cb!.headers["set-cookie"])).toMatch(/sp_sid=/);
    expect((await laptop.get("/me").expect(200)).body.user.id).toBe(me.id);
  });

  it("an unlinked Google account doesn't create or open anything", async () => {
    const c = client();
    const { location, cb } = await googleFlow(c, "login", "test|g-nobody|n@example.com", "/welcome");
    expect(location).toBe("http://localhost:5173/welcome?auth_error=google_not_linked");
    expect(String(cb!.headers["set-cookie"])).not.toMatch(/sp_sid=[^;]/);
    await c.get("/me").expect(401);
  });

  it("the restore code keeps working alongside Google", async () => {
    const { c, me } = await newPlayer();
    await googleFlow(c, "link", "test|g-both|b@example.com");
    expect((await client().post("/auth/restore", { code: me.restoreCode }).expect(200)).body.user.id).toBe(me.id);
  });

  it("unlinking removes the route", async () => {
    const { c } = await newPlayer();
    await googleFlow(c, "link", "test|g-unlink|u@example.com");
    const res = await c.del("/auth/link/google").expect(200);
    expect(res.body.user.identities).toEqual([]);
    const { location } = await googleFlow(client(), "login", "test|g-unlink|u@example.com");
    expect(params(location).get("auth_error")).toBe("google_not_linked");
  });
});

describe("callback hardening", () => {
  async function started() {
    const c = client();
    const start = await c.get("/auth/google/start?intent=login&returnTo=/").expect(302);
    return { c, state: new URL(start.headers.location as string).searchParams.get("state")! };
  }
  const errorOf = (res: { headers: Record<string, unknown> }) => params(res.headers.location as string).get("auth_error");

  it("rejects a wrong state (CSRF)", async () => {
    const { c } = await started();
    expect(errorOf(await c.callback("?code=test|a|a@x.com&state=forged").expect(302))).toBe("google_failed");
  });

  it("rejects a callback without the flow cookie", async () => {
    const { state } = await started();
    expect(errorOf(await client().callback(`?code=test|a|a@x.com&state=${state}`).expect(302))).toBe("google_failed");
  });

  it("the flow cookie is single-use (no replay)", async () => {
    const { c, state } = await started();
    await c.callback(`?code=test|r|r@x.com&state=${state}`).expect(302);
    expect(errorOf(await c.callback(`?code=test|r|r@x.com&state=${state}`).expect(302))).toBe("google_failed");
  });

  it("a tampered flow cookie is rejected", async () => {
    const { state } = await started();
    const res = await client() // empty cookie jar: only the forged cookie is sent
      .raw.get(`/api/auth/google/callback?code=test|t|t@x.com&state=${state}`)
      .set("Cookie", "sp_oauth=eyJzdGF0ZSI6IngifQ.forgedmac")
      .expect(302);
    expect(errorOf(res)).toBe("google_failed");
  });

  it("user cancelling at Google → google_cancelled", async () => {
    const { c, state } = await started();
    expect(errorOf(await c.callback(`?error=access_denied&state=${state}`).expect(302))).toBe("google_cancelled");
  });

  it("a failed code exchange → google_failed", async () => {
    const { c, state } = await started();
    expect(errorOf(await c.callback(`?code=bad&state=${state}`).expect(302))).toBe("google_failed");
  });

  it("returnTo can't redirect off-site", async () => {
    for (const evil of ["//evil.com", "https://evil.com", "/\\evil.com"]) {
      const { location } = await googleFlow(client(), "link", "test|x|x@x.com", evil);
      expect(location.startsWith("http://localhost:5173/?")).toBe(true);
    }
  });
});

describe("stage 3: payouts only after verification", () => {
  async function funded() {
    const p = await newPlayer();
    await sql`insert into ledger (user_id, kind, amount_paise, status, note) values (${p.me.id}, 'adjustment', 8000, 'credited', 'test credit')`;
    return p;
  }
  const setPayoutMode = async (mode: string) => {
    await sql`insert into game_config (key, value) values ('payout', ${sql.json({ mode, minPaise: 5000, perDay: 3, demoSettleSeconds: 60 })})
              on conflict (key) do update set value = excluded.value`;
    clearConfigCache();
  };

  it("an unverified player can't cash out and is told what's missing", async () => {
    const { c } = await funded();
    expect((await c.get("/me").expect(200)).body.user.payout).toEqual({ mode: "simulated", eligible: false, needs: ["identity"] });
    const res = await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(409);
    expect(res.body.error.code).toBe("VERIFICATION_REQUIRED");
  });

  it("linking Google unlocks simulated payouts; unlinking locks them again", async () => {
    const { c } = await funded();
    await linkGoogle(c);
    expect((await c.get("/me").expect(200)).body.user.payout).toEqual({ mode: "simulated", eligible: true, needs: [] });
    await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(201);
    await c.del("/auth/link/google").expect(200);
    expect((await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(409)).body.error.code).toBe("VERIFICATION_REQUIRED");
  });

  it("live mode also needs KYC, and stays closed until a payout partner exists", async () => {
    const { c, me } = await funded();
    await linkGoogle(c);
    await setPayoutMode("live");
    try {
      expect((await c.get("/me").expect(200)).body.user.payout).toEqual({ mode: "live", eligible: false, needs: ["kyc"] });
      expect((await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(409)).body.error.code).toBe("VERIFICATION_REQUIRED");
      await sql`update users set kyc_status = 'verified' where id = ${me.id}`;
      expect((await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(503)).body.error.code).toBe("PAID_PAUSED");
    } finally {
      await setPayoutMode("simulated");
    }
  });

  it("disabled mode pauses payouts for everyone", async () => {
    const { c } = await funded();
    await linkGoogle(c);
    await setPayoutMode("disabled");
    try {
      expect((await c.post("/wallet/payouts", { amountPaise: 5000, upi: "asha@okaxis" }).expect(503)).body.error.code).toBe("PAID_PAUSED");
    } finally {
      await setPayoutMode("simulated");
    }
  });

  it("the demo account ships verified", async () => {
    const res = await client().post("/auth/demo").expect(200);
    expect(res.body.user.payout.eligible).toBe(true);
    expect(res.body.user.identities[0]).toMatchObject({ provider: "google", display: "r•••@example.com" });
  });
});
