// Creates backend/.env from .env.example with three fresh random secrets, so local setup is one command on
// any OS (no openssl, no hand-editing). Never overwrites an existing .env.
//   npm run env --prefix backend
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..");
const target = join(dir, ".env");
if (existsSync(target)) {
  console.log("backend/.env already exists — left as it is.");
  process.exit(0);
}
const secret = () => randomBytes(48).toString("base64");
const env = readFileSync(join(dir, ".env.example"), "utf8").replace(
  /^(SESSION_PEPPER|DEVICE_PEPPER|JOBS_SECRET)=.*$/gm,
  (_, key) => `${key}=${secret()}`,
);
writeFileSync(target, env);
console.log("Created backend/.env with fresh secrets (local Postgres on :5433, demo mode on).");
