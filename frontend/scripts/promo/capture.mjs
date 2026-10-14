// Records real footage of the running app for the promo video (scripts/promo/README in the root README).
// Needs the app running locally (`npm run dev`, demo data seeded). Uses Chrome's screencast, so frames are
// crisp and keep their real timing; each scene becomes a VP9 clip in scripts/promo/.out/clips/.
//
//   node scripts/promo/capture.mjs [baseUrl]
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:5173";
const OUT = join(import.meta.dirname, ".out", "clips");
const H = { "content-type": "application/json", "X-SP-Client": "web" };
mkdirSync(OUT, { recursive: true });

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

/** Screencast `run` into clips/<name>.webm (30 fps, constant frame rate). */
async function record(page, name, run) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  const vp = page.viewportSize();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: vp.width * dpr, maxHeight: vp.height * dpr });
  await run();
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await cdp.detach();

  const dir = join(OUT, `${name}-frames`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir);
  let list = "ffconcat version 1.0\n";
  frames.forEach((f, i) => {
    const file = `f${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(join(dir, file), Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.t ?? end;
    list += `file ${file}\nduration ${Math.max(0.001, next - f.t).toFixed(4)}\n`;
  });
  list += `file f${String(frames.length - 1).padStart(5, "0")}.jpg\n`; // concat demuxer quirk: repeat the last
  writeFileSync(join(dir, "list.txt"), list);
  // Even dimensions for the encoder; constant 30 fps so the compositor can seek frame-exactly.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
    "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "24",
    "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", join(OUT, `${name}.webm`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`  ${name}: ${frames.length} frames → clips/${name}.webm`);
}

async function signIn(page) {
  await page.goto(`${BASE}/terms`);
  await page.evaluate(async (H) => {
    localStorage.setItem("sp.onboarded", "1");
    await fetch("/api/v1/auth/demo", { method: "POST", headers: H, body: "{}" });
  }, H);
}

const newPack = (page) => page.evaluate(async (H) => (await fetch("/api/v1/packs", { method: "POST", headers: H, body: "{}" })).json(), H);

/** Answer the round on screen: tap the photo, or type a word. */
async function answer(page, word, at = 0.45) {
  // Wait for the round to render: a photo to pinch, or a word box.
  await page.locator('[role="application"], input[type="text"], input:not([type])').first().waitFor({ timeout: 10000 });
  const board = page.locator('[role="application"]');
  if (await board.count()) {
    const box = await board.boundingBox();
    const vp = page.viewportSize();
    // The board's square can be wider than the screen (phone fill mode): aim inside the visible part.
    const x = Math.min(Math.max(box.x + box.width / 2, 40), vp.width - 40);
    await page.mouse.click(x, box.y + box.height * at);
  } else {
    const input = page.getByRole("textbox").first();
    await input.fill(word);
    await input.press("Enter");
    await input.press("Enter");
  }
  await page.getByRole("button", { name: /Next|See results/ }).waitFor({ timeout: 10000 });
}

const browser = await chromium.launch();
console.log("Recording scenes:");

// 1 · The welcome story, phone.
{
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/welcome`);
  await page.getByRole("heading", { level: 2 }).first().waitFor();
  await record(page, "welcome", () => page.waitForTimeout(10500));
  await ctx.close();
}

// 2 · Playing: tap the photo, the reveal, the crowd heatmap. Phone.
{
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await signIn(page);
  const pack = await newPack(page);
  await page.goto(`${BASE}/play/${pack.packId}`);
  await page.waitForTimeout(1500);
  await record(page, "play", async () => {
    await page.waitForTimeout(1200);
    await answer(page, "chai", 0.42);
    await page.waitForTimeout(4200);
    await page.getByRole("button", { name: /Next/ }).click();
    await page.waitForTimeout(1300);
    await answer(page, "sunrise", 0.5);
    await page.waitForTimeout(4200);
  });
  await ctx.close();
}

// 3 · Results: the rounds dealt back as 3D cards, then Save → XP bar + rewards. Desktop.
{
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  await signIn(page);
  const pack = await newPack(page);
  await page.goto(`${BASE}/play/${pack.packId}`);
  // Play until the last round (the server may hand back a pack that's already part-played).
  const words = ["chai", "rain", "dog", "kite", "road"];
  for (let i = 0; ; i++) {
    await page.waitForTimeout(500);
    await answer(page, words[i % words.length]);
    await page.waitForTimeout(700);
    if (await page.getByRole("button", { name: /See results/ }).count()) break;
    await page.getByRole("button", { name: /Next/ }).click();
  }
  await record(page, "results", async () => {
    await page.getByRole("button", { name: /See results/ }).click();
    await page.waitForURL(/\/done$/);
    await page.waitForTimeout(3600);
    await page.getByRole("button", { name: /Save this moment/ }).click();
    await page.waitForTimeout(3200);
  });
  await ctx.close();
}

// 4 · Desktop: the curved rail sliding between tabs.
{
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  await signIn(page);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(2000);
  await record(page, "desktop", async () => {
    await page.waitForTimeout(1400);
    for (const label of ["Daily", "People", "Me"]) {
      await page.locator("nav[aria-label] a", { hasText: label }).first().click();
      await page.waitForTimeout(2100);
    }
    await page.locator("nav[aria-label] a", { hasText: "Home" }).first().click();
    await page.waitForTimeout(1600);
  });
  await ctx.close();
}

await browser.close();
console.log("Done.");
