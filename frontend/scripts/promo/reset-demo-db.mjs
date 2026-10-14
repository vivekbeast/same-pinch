// Fresh demo database for recording: drop → create → migrate → seed, so every capture starts from the
// same state (no half-played packs). Never touches your dev database: it uses `<db>_promo`.
//   node scripts/promo/reset-demo-db.mjs   (then run the API with DATABASE_URL printed below)
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const backend = join(import.meta.dirname, "..", "..", "..", "backend");
process.loadEnvFile(join(backend, ".env"));
const require = createRequire(join(backend, "package.json"));
const postgres = require("postgres");

const url = new URL(process.env.DATABASE_URL);
const name = `${url.pathname.slice(1)}_promo`;
const admin = new URL(url);
admin.pathname = "/postgres";
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
await sql.unsafe(`drop database if exists "${name}" with (force)`);
await sql.unsafe(`create database "${name}"`);
await sql.end();

url.pathname = `/${name}`;
const env = { ...process.env, DATABASE_URL: url.toString() };
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
for (const script of ["db:migrate", "db:seed"]) execFileSync(npm, ["run", script, "--silent"], { cwd: backend, env, stdio: "ignore", shell: process.platform === "win32" });
console.log(`Promo database ready: ${name}\nStart the API on it:  DATABASE_URL=${url.toString().replace(/\/\/[^@]*@/, "//***@")} npm run dev --prefix backend`);
