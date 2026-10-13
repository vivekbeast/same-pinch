// Fetches CC0 / public-domain photos for every image & vibe prompt from Openverse, crops them square,
// encodes WebP at 320/480/720 into public/prompts/ (served from the CDN, cached forever), and logs
// source + licence in content/CREDITS.md (docs/CONTENT_I18N.md §4).
//
//   node scripts/fetch-prompt-photos.mjs            # fetch missing ones
//   node scripts/fetch-prompt-photos.mjs --redo key  # pick the next candidate for one prompt
//
// content/prompt-photos.json pins each choice so reruns are deterministic.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "prompts");
const CONTENT = join(ROOT, "..", "content");
const PINS = join(CONTENT, "prompt-photos.json");
mkdirSync(OUT, { recursive: true });
mkdirSync(CONTENT, { recursive: true });

/** prompt key → search query (subject lines live in backend/src/db/seed/data/prompts.ts). */
const QUERIES = {
  "chai-glass": "cutting chai glass",
  "samosa-plate": "samosa",
  "idli-sambar": "idli sambar",
  "mango-pile": "mangoes market",
  "masala-dosa": "dosa",
  "jalebi-tray": "jalebi",
  "pani-puri": "pani puri",
  "veg-thali": "vegetarian thali",
  "roasted-corn": "roasted corn cob",
  "monsoon-street": "rain umbrellas street",
  "rainbow-field": "double rainbow sky",
  "lightning-night": "lightning night sky",
  "hot-sun-field": "dry cracked earth",
  "foggy-road": "foggy road",
  "auto-rickshaw": "tuk tuk rickshaw",
  "traffic-jam": "traffic jam india",
  "train-platform": "railway station platform india",
  "street-dog": "dog sleeping street",
  "cow-road": "cow on road india",
  "market-crowd": "vegetable market",
  "diyas-row": "diya oil lamps",
  "rangoli-floor": "rangoli design",
  "kites-sky": "kites in sky",
  "colour-powder": "colour powder holi",
  "fireworks-night": "fireworks",
  "sweets-box": "laddu",
  "notebook-pen": "notebook and pen",
  "college-canteen": "lunch plate rice curry",
  "backpack-desk": "school backpack",
  "cricket-gully": "cricket stumps",
  "phone-charging": "smartphone charging",
  "bus-window-dusk": "bus window sunset",
  "goa-beach": "tropical beach palm trees",
  "snow-mountains": "snow mountains",
  "backwater-boat": "canoe on lake",
  "bicycle-lane": "old bicycle against wall",
  "gold-cat": "cat sitting",
  "gold-banana": "bunch of bananas",
  "gold-elephant": "elephant walking",
  "gold-clock": "wall clock",
  "gold-peacock": "peacock",
  "gold-tree": "lone tree in field",
  "gold-moon": "full moon",
  "gold-car": "red car parked",
  "vibe-bus-stop-night": "bus stop at night",
  "vibe-sunrise-sea": "sunrise over sea",
  "vibe-friends-silhouette": "silhouette friends sunset",
  "vibe-rain-window": "raindrops on window",
  "vibe-exam-hall": "empty classroom",
  "vibe-festival-lights": "string lights at night",
  "vibe-honking-traffic": "city traffic congestion",
  "vibe-lazy-afternoon": "ceiling fan",
};

const pins = existsSync(PINS) ? JSON.parse(readFileSync(PINS, "utf8")) : {};
const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1].split(",") : []);
const redo = new Set(arg("--redo")); // pick a different photo
const refresh = new Set(arg("--refresh")); // re-encode the pinned photo

async function search(q) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&mature=false&page_size=20`;
  const res = await fetch(url, { headers: { "User-Agent": "same-pinch-content-script/0.1" } });
  if (!res.ok) throw new Error(`openverse ${res.status} for "${q}"`);
  const j = await res.json();
  return (j.results ?? []).filter((r) => (r.width ?? 0) >= 700 && (r.height ?? 0) >= 500 && /\.(jpe?g|png|webp)(\?|$)/i.test(r.url));
}

/**
 * Square crop, WebP at 720/480/320, quality first. No byte budget: photos are static files served from
 * the CDN with a one-year immutable cache (docs/DEPLOYMENT.md §5) and lazy-loaded by the app.
 */
async function encode(buf, key) {
  for (const w of [720, 480, 320]) {
    const out = await sharp(buf).rotate().resize(w, w, { fit: "cover", position: "attention" }).webp({ quality: 80, effort: 5 }).toBuffer();
    writeFileSync(join(OUT, `${key}-${w}.webp`), out);
  }
}

for (const [key, q] of Object.entries(QUERIES)) {
  const have = existsSync(join(OUT, `${key}-480.webp`));
  if (have && pins[key] && !redo.has(key) && !refresh.has(key)) continue;
  try {
    const results = await search(q);
    const skip = new Set(pins[key]?.rejected ?? []);
    if (redo.has(key) && pins[key]) skip.add(pins[key].id);
    const pick = refresh.has(key) && pins[key] ? (results.find((r) => r.id === pins[key].id) ?? results.find((r) => !skip.has(r.id))) : results.find((r) => !skip.has(r.id));
    if (!pick) {
      console.warn(`no candidate for ${key} ("${q}")`);
      continue;
    }
    const img = await fetch(pick.url, { headers: { "User-Agent": "same-pinch-content-script/0.1" }, signal: AbortSignal.timeout(30_000) });
    if (!img.ok) throw new Error(`download ${img.status}`);
    await encode(Buffer.from(await img.arrayBuffer()), key);
    pins[key] = {
      id: pick.id,
      title: pick.title,
      creator: pick.creator ?? null,
      license: pick.license,
      source: pick.foreign_landing_url ?? pick.url,
      rejected: [...skip],
    };
    writeFileSync(PINS, JSON.stringify(pins, null, 2) + "\n");
    console.log(`ok   ${key}  ${pick.license}  ${pick.title?.slice(0, 50)}`);
  } catch (e) {
    console.warn(`fail ${key}: ${e.message}`);
  }
}

const lines = Object.entries(pins)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, p]) => `| \`${k}\` | ${String(p.title ?? "").replace(/\|/g, "/")} | ${p.creator ?? "unknown"} | ${p.license.toUpperCase()} | ${p.source} |`);
writeFileSync(
  join(CONTENT, "CREDITS.md"),
  `# CREDITS.md — prompt photos\n\nAll prompt photos are CC0 or public domain (no attribution required); credited anyway.\nFetched by \`frontend/scripts/fetch-prompt-photos.mjs\` from Openverse; choices pinned in \`prompt-photos.json\`.\n\n| Prompt | Title | Creator | Licence | Source |\n|---|---|---|---|---|\n${lines.join("\n")}\n`,
);
console.log(`\n${Object.keys(pins).length} prompts credited in content/CREDITS.md`);
