// PWA icons from the pinch glyph (docs/UI_DIRECTION.md): violet tile, white mark.
//   node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

const glyph = `<g fill="none" stroke="#fff" stroke-linecap="round">
  <path d="M4.5 8.5C12 5.5 20 6.8 21.6 14.4" stroke-width="5.2"/>
  <path d="M4.5 23.5C12 26.5 20 25.2 21.6 17.6" stroke-width="5.2"/>
  <path d="M26 10.6l2.4-1.8M26.8 16h3M26 21.4l2.4 1.8" stroke-width="2.2"/></g>`;

/** scale = glyph size as a share of the canvas; radius 0 for maskable (the OS applies its own mask). */
const svg = (scale, radius) => {
  const s = 32 * (1 / scale);
  const off = (s - 32) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" rx="${radius * s}" fill="#5A3BE7"/>
    <g transform="translate(${off} ${off})">${glyph}</g></svg>`);
};

const icons = [
  ["192.png", 192, svg(0.62, 0.22)],
  ["512.png", 512, svg(0.62, 0.22)],
  ["maskable-512.png", 512, svg(0.5, 0)], // keeps the mark inside the 80% safe zone
  ["apple-touch-180.png", 180, svg(0.58, 0)],
];
for (const [name, size, src] of icons) {
  await sharp(src, { density: 400 }).resize(size, size).png({ compressionLevel: 9 }).toFile(join(OUT, name));
  console.log("icons/" + name);
}
