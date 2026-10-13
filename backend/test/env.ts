import { existsSync } from "node:fs";

/** Load backend/.env (local runs; CI passes env vars directly). */
export function loadEnv() {
  if (existsSync(".env")) process.loadEnvFile(".env");
}

/** Same server as DATABASE_URL, database name suffixed with `_test`. */
export function testDatabaseUrl() {
  loadEnv();
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const u = new URL(process.env.DATABASE_URL!);
  if (!u.pathname.endsWith("_test")) u.pathname = `${u.pathname}_test`;
  return u.toString();
}
