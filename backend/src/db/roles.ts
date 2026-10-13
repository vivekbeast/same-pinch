// Creates/updates the least-privilege role the API connects as (docs/DATA_MODEL.md "Database roles"):
// DML only, DELETE only where data is meant to be removed, no DDL. Run as the owner after migrating:
//   APP_DB_PASSWORD=… npm run db:roles
// Then point the API's DATABASE_URL at app_user.
import postgres from "postgres";

const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
const password = process.env.APP_DB_PASSWORD;
if (!url) throw new Error("DATABASE_URL (or DATABASE_URL_OWNER) is required");
if (!password || password.length < 16) throw new Error("APP_DB_PASSWORD (16+ chars) is required");

// Tables where the app itself deletes rows. FK cascades (e.g. account deletion → ledger) run with the
// table owner's rights, so child tables need no DELETE grant.
const DELETABLE = ["sessions", "rate_limits", "events", "users"];

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const [row] = await sql<{ exists: boolean }[]>`select exists(select 1 from pg_roles where rolname = 'app_user')`;
  const exists = row?.exists ?? false;
  const quoted = "'" + password.replace(/'/g, "''") + "'";
  await sql.unsafe(`${exists ? "alter" : "create"} role app_user with login password ${quoted}`);

  await sql.unsafe(`
    revoke all on all tables in schema public from app_user;
    grant usage on schema public to app_user;
    grant select, insert, update on all tables in schema public to app_user;
    grant delete on ${DELETABLE.join(", ")} to app_user;
    grant usage, select on all sequences in schema public to app_user;
    revoke all on drizzle.__drizzle_migrations from app_user;
  `);
  console.log("app_user ready (DML only; DELETE on " + DELETABLE.join(", ") + ")");
} finally {
  await sql.end();
}
