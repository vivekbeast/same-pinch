// Bundle budget gate (docs/PERFORMANCE.md §2): initial JS ≤ 150 KB gzip, initial CSS ≤ 18 KB gzip.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dir = join(import.meta.dirname, "..", "dist", "assets");
const html = readFileSync(join(import.meta.dirname, "..", "dist", "index.html"), "utf8");
const initial = readdirSync(dir).filter((f) => html.includes(f));
const kb = (f) => gzipSync(readFileSync(join(dir, f))).length / 1024;
const js = initial.filter((f) => f.endsWith(".js")).reduce((a, f) => a + kb(f), 0);
const css = initial.filter((f) => f.endsWith(".css")).reduce((a, f) => a + kb(f), 0);
console.log(`initial JS ${js.toFixed(1)} KB gzip (budget 150), CSS ${css.toFixed(1)} KB gzip (budget 18)`);
if (js > 150 || css > 18) {
  console.error("bundle budget exceeded");
  process.exit(1);
}
