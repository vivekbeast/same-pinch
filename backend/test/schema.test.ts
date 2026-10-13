// Integration tests for database-level rules (constraints, triggers, view, role grants).
// Needs the local Postgres from docker-compose with migrations applied. Every test runs in a
// transaction that is rolled back, so the database is left untouched.
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { max: 2, onnotice: () => {} });
afterAll(() => sql.end());

const ROLLBACK = Symbol("rollback");
type Tx = postgres.TransactionSql;

/** Run `fn` in a transaction and always roll it back. */
async function inTx(fn: (tx: Tx) => Promise<void>) {
  try {
    await sql.begin(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

/** Expect a statement to be rejected; matches constraint name or error message. */
async function rejects(tx: Tx, run: (sp: Tx) => Promise<unknown>, match: string | RegExp) {
  let err: (Error & { constraint_name?: string }) | undefined;
  try {
    await tx.savepoint(async (sp) => {
      await run(sp);
    });
  } catch (e) {
    err = e as Error & { constraint_name?: string };
  }
  expect(err, `expected rejection matching ${match}`).toBeDefined();
  const text = `${err!.constraint_name ?? ""} ${err!.message}`;
  if (typeof match === "string") expect(text).toContain(match);
  else expect(text).toMatch(match);
}

async function fixtures(tx: Tx) {
  const [user] = await tx`
    insert into users (handle, age_confirmed_at) values ('test_user_1', now()) returning id`;
  const [prompt] = await tx`
    insert into prompts (kind, asset_key, text_key) values ('image', 'test-asset-1', 'prompt.what_do_you_see') returning id`;
  const [pack] = await tx`insert into packs (user_id) values (${user!.id}) returning id`;
  return { userId: user!.id as string, promptId: prompt!.id as string, packId: pack!.id as string };
}

describe("reference data", () => {
  it("rejects malformed handles and region codes", () =>
    inTx(async (tx) => {
      await rejects(tx, (sp) => sp`insert into users (handle, age_confirmed_at) values ('Bad Handle', now())`, "users_handle_format");
      await rejects(tx, (sp) => sp`insert into regions (code, name, kind, zone) values ('kar', 'x', 'state', 'south')`, "regions_code_format");
    }));
});

describe("ledger", () => {
  it("enforces sign and status by kind", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      await rejects(
        tx,
        (sp) => sp`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', -50, 'credited', ${f.packId})`,
        "ledger_sign_by_kind",
      );
      await rejects(
        tx,
        (sp) => sp`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 50, 'paid', ${f.packId})`,
        "ledger_status_by_kind",
      );
      await rejects(
        tx,
        (sp) => sp`insert into ledger (user_id, kind, amount_paise, status) values (${f.userId}, 'reversal', -50, 'credited')`,
        "ledger_reversal_has_note",
      );
    }));

  it("credits a pack at most once", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      await tx`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 340, 'credited', ${f.packId})`;
      await rejects(
        tx,
        (sp) => sp`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 340, 'credited', ${f.packId})`,
        "ledger_one_earn_per_pack",
      );
    }));

  it("is append-only: amounts never change, rows never disappear, status only moves forward", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      const [row] = await tx`
        insert into ledger (user_id, kind, amount_paise, status, pack_id)
        values (${f.userId}, 'earn', 340, 'pending_review', ${f.packId}) returning id`;
      await rejects(tx, (sp) => sp`update ledger set amount_paise = 1 where id = ${row!.id}`, "append-only");
      await rejects(tx, (sp) => sp`delete from ledger where id = ${row!.id}`, "append-only");
      await tx`update ledger set status = 'credited' where id = ${row!.id}`; // release held earnings: allowed
      await rejects(tx, (sp) => sp`update ledger set status = 'pending_review' where id = ${row!.id}`, "cannot move");
    }));

  it("lets account deletion cascade through the ledger (DPDP erasure)", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      await tx`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 340, 'credited', ${f.packId})`;
      await tx`delete from users where id = ${f.userId}`;
      const [{ n }] = (await tx`select count(*)::int as n from ledger where user_id = ${f.userId}`) as unknown as [{ n: number }];
      expect(n).toBe(0);
    }));
});

describe("payouts", () => {
  it("enforces the ₹50 minimum and one-way status", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      await rejects(
        tx,
        (sp) => sp`insert into payouts (user_id, amount_paise, upi_masked) values (${f.userId}, 4999, 'v***@okaxis')`,
        "payouts_min_amount",
      );
      const [p] = await tx`insert into payouts (user_id, amount_paise, upi_masked) values (${f.userId}, 5000, 'v***@okaxis') returning id`;
      await rejects(tx, (sp) => sp`update payouts set status = 'paid' where id = ${p!.id}`, "payouts_settled_consistent");
      await tx`update payouts set status = 'paid', settled_at = now() where id = ${p!.id}`;
      await rejects(tx, (sp) => sp`update payouts set status = 'pending', settled_at = null where id = ${p!.id}`, "cannot move");
      await rejects(tx, (sp) => sp`update payouts set amount_paise = 9000 where id = ${p!.id}`, "immutable");
    }));
});

describe("user_balances view", () => {
  it("counts credited money, holds review money, reserves pending payouts, returns failed ones", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      const [pack2] = await tx`insert into packs (user_id) values (${f.userId}) returning id`;
      await tx`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 6000, 'credited', ${f.packId})`;
      await tx`insert into ledger (user_id, kind, amount_paise, status, pack_id) values (${f.userId}, 'earn', 300, 'pending_review', ${pack2!.id})`;
      const [p1] = await tx`insert into payouts (user_id, amount_paise, upi_masked) values (${f.userId}, 5000, 'v***@okaxis') returning id`;
      await tx`insert into ledger (user_id, kind, amount_paise, status, payout_id) values (${f.userId}, 'payout', -5000, 'pending', ${p1!.id})`;

      let [b] = await tx`select * from user_balances where user_id = ${f.userId}`;
      expect(Number(b!.balance_paise)).toBe(1000);
      expect(Number(b!.held_paise)).toBe(300);
      expect(Number(b!.payout_pending_paise)).toBe(5000);

      await tx`update ledger set status = 'failed' where payout_id = ${p1!.id}`;
      [b] = await tx`select * from user_balances where user_id = ${f.userId}`;
      expect(Number(b!.balance_paise)).toBe(6000); // failed payout returns the money
    }));
});

describe("play tables", () => {
  it("keeps answers consistent", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      const id = () => crypto.randomUUID();
      await rejects(
        tx,
        (sp) => sp`insert into answers (id, user_id, pack_id, prompt_id, words, langs, played_at, result)
                   values (${id()}, ${f.userId}, ${f.packId}, ${f.promptId}, ${["chai"]}, '{en}', now(), 'skipped')`,
        "answers_skipped_iff_empty",
      );
      await rejects(
        tx,
        (sp) => sp`insert into answers (id, user_id, pack_id, prompt_id, words, langs, played_at, result)
                   values (${id()}, ${f.userId}, ${f.packId}, ${f.promptId}, ${["chai", "tea"]}, '{en}', now(), 'exact')`,
        "answers_langs_match_words",
      );
      await rejects(
        tx,
        (sp) => sp`insert into answers (id, user_id, pack_id, prompt_id, words, langs, played_at)
                   values (${id()}, ${f.userId}, ${f.packId}, ${f.promptId}, ${["chai"]}, '{en}', now())`,
        "answers_result_required",
      );
      await tx`insert into answers (id, user_id, pack_id, prompt_id, words, langs, played_at, result)
               values (${id()}, ${f.userId}, ${f.packId}, ${f.promptId}, ${["chai"]}, '{en}', now(), 'exact')`;
      await rejects(
        tx,
        (sp) => sp`insert into answers (id, user_id, pack_id, prompt_id, words, langs, played_at, result)
                   values (${id()}, ${f.userId}, ${f.packId}, ${f.promptId}, ${["tea"]}, '{en}', now(), 'exact')`,
        "answers_one_per_round",
      );
    }));

  it("keeps packs and prompts consistent", () =>
    inTx(async (tx) => {
      const f = await fixtures(tx);
      await rejects(tx, (sp) => sp`update packs set collected_at = now() where id = ${f.packId}`, "packs_collect_consistent");
      await rejects(tx, (sp) => sp`insert into pack_rounds (pack_id, idx, prompt_id) values (${f.packId}, 10, ${f.promptId})`, "pack_rounds_idx_range");
      await rejects(
        tx,
        (sp) => sp`insert into prompts (kind, asset_key, text_key) values ('question', 'has-asset', 'prompt.q.x')`,
        "prompts_asset_matches_kind",
      );
      await rejects(
        tx,
        (sp) => sp`insert into prompts (kind, text_key, is_gold) values ('question', 'prompt.q.y', true)`,
        "prompts_gold_concepts",
      );
    }));
});

describe("app_user role", () => {
  it("cannot delete ledger rows or run DDL", async () => {
    const [{ exists }] = (await sql`select exists(select 1 from pg_roles where rolname = 'app_user')`) as unknown as [{ exists: boolean }];
    if (!exists) return; // created by `npm run db:roles`; skipped when absent
    await inTx(async (tx) => {
      await tx`set local role app_user`;
      await rejects(tx, (sp) => sp`delete from ledger`, "permission denied");
      await rejects(tx, (sp) => sp`create table hack (id int)`, "permission denied");
    });
  });
});
