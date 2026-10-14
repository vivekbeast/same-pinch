// Crowd heatmap (the "hive mind" reveal): where everyone else pinched on a photo. Pure — the points are
// read by the round service, after the player's own answer is stored.
import type { GameConfig } from "./config.js";

export interface Point {
  x: number;
  y: number;
}

export interface Crowd {
  n: number;
  /** % of the crowd within the same-spot radius of `you` (0–100). */
  near: number;
  /** [x, y, count] at cell centres on the 0–1000 grid, busiest first. */
  cells: [number, number, number][];
}

export function crowdHeat(points: Point[], you: Point, sameSpot: number, cfg: GameConfig["crowd"]): Crowd | null {
  if (points.length < cfg.minAnswers) return null;
  const bins = new Map<string, [number, number, number]>();
  let near = 0;
  for (const p of points) {
    if (Math.hypot(p.x - you.x, p.y - you.y) <= sameSpot) near++;
    const cx = Math.floor(Math.min(p.x, 999) / cfg.cell);
    const cy = Math.floor(Math.min(p.y, 999) / cfg.cell);
    const key = `${cx},${cy}`;
    const bin = bins.get(key);
    if (bin) bin[2]++;
    else bins.set(key, [cx * cfg.cell + cfg.cell / 2, cy * cfg.cell + cfg.cell / 2, 1]);
  }
  const cells = [...bins.values()].sort((a, b) => b[2] - a[2] || a[1] - b[1] || a[0] - b[0]).slice(0, cfg.maxCells);
  return { n: points.length, near: Math.round((near / points.length) * 100), cells };
}
