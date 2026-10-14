// Renders the promo film from promo.html + the clips capture.mjs recorded. Steps the stage frame by frame
// (deterministic), then encodes with ffmpeg into docs/media/:
//   same-pinch-promo.mp4   1920×1080, 30 fps, H.264 (plays everywhere)
//   promo-poster.jpg       the title frame, for the README
//   promo-preview.gif      a short loop of the game for the README
//
//   node scripts/promo/render.mjs                    the 48 s promo (promo.html)
//   node scripts/promo/render.mjs --film explainer   the ≈2:45 explainer (explainer.html) →
//                                                    same-pinch-explainer.mp4 + explainer-poster.jpg
//   node scripts/promo/render.mjs --stills 2,9,20   just those moments, as PNGs in .out/stills (design checks)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const FPS = 30;
const here = import.meta.dirname;
const out = join(here, ".out");
const media = join(here, "..", "..", "..", "docs", "media");
const stillsArg = process.argv.indexOf("--stills");
const filmArg = process.argv.indexOf("--film");
const film = filmArg > -1 ? process.argv[filmArg + 1] : "promo";
if (!["promo", "explainer"].includes(film)) throw new Error(`Unknown film "${film}" (promo | explainer)`);

const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(here, `${film}.html`)).href);
const total = await page.evaluate(() => window.setup());
// The GIF loops the moment you tap and the crowd heatmap appears: from just before the tap in the play scene.
const gifStart = await page.evaluate(() => (window.segs.find((s) => s.id === "s-play")?.start ?? 0) + 1.0);
console.log(`Film length ${total.toFixed(2)} s`);

if (stillsArg > -1) {
  const dir = join(out, `stills-${film}`);
  mkdirSync(dir, { recursive: true });
  for (const t of process.argv[stillsArg + 1].split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(dir, `t${t}.png`) });
    console.log(`  still t=${t}`);
  }
  await browser.close();
  process.exit(0);
}

const frames = join(out, `frames-${film}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const count = Math.ceil(total * FPS);
for (let i = 0; i < count; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: join(frames, `f${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 94 });
  if (i % 150 === 0) console.log(`  frame ${i}/${count}`);
}
await browser.close();

mkdirSync(media, { recursive: true });
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const mp4 = join(media, film === "promo" ? "same-pinch-promo.mp4" : "same-pinch-explainer.mp4");
// JPEG frames are full-range; convert to standard TV-range yuv420p so every player shows the right colours.
ff("-framerate", String(FPS), "-i", join(frames, "f%05d.jpg"), "-vf", "scale=in_range=pc:out_range=tv,format=yuv420p",
  "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-movflags", "+faststart", mp4);
// Poster: the title card once it has landed.
ff("-ss", film === "promo" ? "2.6" : "3.2", "-i", mp4, "-frames:v", "1", "-q:v", "3", join(media, `${film}-poster.jpg`));
if (film === "explainer") {
  rmSync(frames, { recursive: true, force: true });
  console.log("Done → docs/media/ (same-pinch-explainer.mp4, explainer-poster.jpg)");
  process.exit(0);
}
// Preview GIF: the game segment (tap → reveal → heatmap), small and looping.
const palette = join(out, "palette.png");
const gifIn = ["-ss", gifStart.toFixed(2), "-t", "5.5", "-i", mp4];
ff(...gifIn, "-vf", "fps=12,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff", palette);
ff(...gifIn, "-i", palette, "-lavfi", "fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", join(media, "promo-preview.gif"));
rmSync(frames, { recursive: true, force: true });
console.log(`Done → docs/media/ (same-pinch-promo.mp4, promo-poster.jpg, promo-preview.gif)`);
