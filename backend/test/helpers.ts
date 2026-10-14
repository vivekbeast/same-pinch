// API test helpers: a cookie-keeping client with the headers the web app sends, plus direct SQL.
import { randomUUID } from "node:crypto";
import request from "supertest";
import postgres from "postgres";
import { buildApp } from "../src/app";
import { setGoogleExchange } from "../src/services/identity.service";

export const ORIGIN = "http://localhost:5173";
export const app = buildApp();
export const sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => {} });

// Random range per test file: files share one database (and its rate-limit counters) but not modules.
let ipCounter = Math.floor(Math.random() * 60_000);

/** One "browser": own cookie jar, own device id, own IP (so per-IP rate limits don't collide). */
export function client(opts: { ip?: string } = {}) {
  const agent = request.agent(app);
  const ip = opts.ip ?? `10.${Math.floor(ipCounter / 62_500) % 250}.${Math.floor(ipCounter / 250) % 250}.${ipCounter++ % 250}`;
  const device = randomUUID();
  const h = (r: request.Test) => r.set("Origin", ORIGIN).set("X-SP-Client", "web").set("X-SP-Device", device).set("X-Forwarded-For", ip);
  return {
    ip,
    device,
    get: (path: string) => h(agent.get(`/api/v1${path}`)),
    post: (path: string, body?: object) => h(agent.post(`/api/v1${path}`)).send(body ?? {}),
    patch: (path: string, body: object) => h(agent.patch(`/api/v1${path}`)).send(body),
    del: (path: string) => h(agent.delete(`/api/v1${path}`)),
    /** The OAuth redirect URI lives outside /api/v1 (it must match the Google console). */
    callback: (query: string) => h(agent.get(`/api/auth/google/callback${query}`)),
    raw: agent,
  };
}
export type Client = ReturnType<typeof client>;

/** A complete sign-up body (D45): 18+, terms, and a coarse location. */
export const SIGNUP = { uiLang: "en", ageConfirmed: true, termsAccepted: true, stateCode: "KA", city: "Mysuru" } as const;

/** Sign up a fresh anonymous player. */
export async function newPlayer(uiLang = "en") {
  const c = client();
  const res = await c.post("/auth/anon", { ...SIGNUP, uiLang }).expect(201);
  return { c, me: res.body.user as { id: string; handle: string; restoreCode: string } };
}

export const roundBody = (packId: string, promptId: string, words: { text: string; lang: string }[], extra: object = {}) => ({
  attemptId: randomUUID(),
  packId,
  promptId,
  words,
  playedAt: new Date().toISOString(),
  responseMs: 4_000,
  ...extra,
});

const HUMAN_WORDS = ["chai", "rain", "dog", "mango", "bus", "kite", "happy", "road", "sweet", "sky"];

/**
 * Play every round of a pack. Default answers vary per round like a person's would — the same words
 * on most rounds is (correctly) flagged as bot-like and held for review.
 */
export async function playPack(c: Client, pack: { packId: string; rounds: { promptId: string }[] }, words?: { text: string; lang: string }[]) {
  const results = [];
  for (const [i, r] of pack.rounds.entries()) {
    const w = words ?? [{ text: HUMAN_WORDS[i % HUMAN_WORDS.length]!, lang: "en" }];
    const res = await c.post("/rounds", roundBody(pack.packId, r.promptId, w)).expect(200);
    results.push(res.body);
  }
  return results;
}

/** Deterministic test prompt with exactly one recorded partner answer (bypasses random partner choice). */
export async function promptWithPartner(
  key: string,
  partnerWords: string[],
  partnerLangs: string[],
  extra: { gold?: string[]; burnt?: string[]; pinch?: { x: number; y: number }; question?: boolean } = {},
) {
  const [p] = extra.question
    ? await sql<{ id: string }[]>`
        insert into prompts (kind, asset_key, text_key) values ('question', null, ${`prompt.q.${key}`}) returning id`
    : await sql<{ id: string }[]>`
        insert into prompts (kind, asset_key, text_key, is_gold, gold_concepts)
        values ('image', ${key}, 'prompt.what_do_you_see', ${!!extra.gold}, ${extra.gold ?? null})
        returning id`;
  const [author] = await sql<{ id: string }[]>`select id from users where handle = 'asha_shillong'`;
  await sql`
    insert into answers (id, user_id, prompt_id, words, langs, concept_ids, author_state, author_gold_acc, played_at, is_seed, pinch_x, pinch_y)
    values (${randomUUID()}, ${author!.id}, ${p!.id}, ${partnerWords}, ${partnerLangs}::lang[], '{}', 'ML', 0.9, now(), true,
            ${extra.pinch?.x ?? null}, ${extra.pinch?.y ?? null})`;
  for (const c of extra.burnt ?? []) await sql`insert into prompt_burnt (prompt_id, concept_id) values (${p!.id}, ${c})`;
  return p!.id;
}

/**
 * A pack for `userId` whose first round is `promptId`, the rest filled with seeded prompts. Never another
 * test's prompt: test files share the database, so that would race with their own assertions.
 */
export async function packWith(userId: string, promptId: string) {
  const others = await sql<{ id: string }[]>`
    select id from prompts
    where active and not is_gold and id <> ${promptId} and kind = 'image' and asset_key !~ '^(t-|t_|test-)'
    order by id limit 4`;
  const [pack] = await sql<{ id: string }[]>`insert into packs (user_id) values (${userId}) returning id`;
  const ids = [promptId, ...others.map((o) => o.id)];
  for (const [idx, id] of ids.entries()) await sql`insert into pack_rounds (pack_id, idx, prompt_id) values (${pack!.id}, ${idx}, ${id})`;
  return { packId: pack!.id, rounds: ids.map((promptId) => ({ promptId })) };
}

export const SECRET_KEYS = /isGold|is_gold|goldConcepts|gold_concepts|goldCorrect|gold_correct|restoreCodeHash|tokenHash|deviceHash|"userId"|authorDeviceHash/;

// Random start per test file (modules are isolated per file), well away from the demo account's 0001.
// ---------- Google (stage 2) without the network ----------
// Fake code exchange: a "code" of the form "test|<sub>|<email>" is accepted; anything else fails.
setGoogleExchange(async (code) => {
  const [kind, sub, email] = code.split("|");
  if (kind !== "test" || !sub || !email) throw new Error("bad code");
  return { sub, email };
});

/** Drive the real redirect round trip: /auth/google/start → (Google) → callback. Returns the final app URL. */
export async function googleFlow(c: Client, intent: "login" | "link", code: string, returnTo = "/settings") {
  const start = await c.get(`/auth/google/start?intent=${intent}&returnTo=${encodeURIComponent(returnTo)}`).expect(302);
  const loc = new URL(start.headers.location as string);
  if (loc.host !== "accounts.google.com") return { location: loc.toString(), start };
  const state = loc.searchParams.get("state")!;
  const cb = await c.callback(`?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`).expect(302);
  return { location: cb.headers.location as string, start, cb };
}

let googleN = 0;
/** Link a fresh Google account to this player — the stage 3 prerequisite for payouts. */
export async function linkGoogle(c: Client) {
  const sub = `sub-${Date.now()}-${googleN++}`;
  const { location } = await googleFlow(c, "link", `test|${sub}|player${googleN}@example.com`);
  if (!location.includes("linked=google")) throw new Error(`link failed: ${location}`);
  return sub;
}
