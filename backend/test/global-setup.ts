// Fresh `<db>_test` database for every test run: drop → create → migrate → seed.
// Dev data is never touched.
import postgres from "postgres";
import { runMigrations } from "../src/db/migrate";
import { runSeed } from "../src/db/seed/index";
import { testDatabaseUrl } from "./env";

export default async function setup() {
  const testUrl = testDatabaseUrl();
  const admin = new URL(testUrl);
  const dbName = admin.pathname.slice(1);
  admin.pathname = "/postgres";

  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe(`drop database if exists "${dbName}" with (force)`);
  await sql.unsafe(`create database "${dbName}"`);
  await sql.end();

  await runMigrations(testUrl);
  await runSeed({ url: testUrl, pepper: process.env.SESSION_PEPPER!, quiet: true });
}
