import { db } from "../db/client.js";
import { gameConfig } from "../db/schema.js";
import { DEFAULT_CONFIG, type GameConfig } from "../domain/config.js";
import { TtlCache } from "../lib/cache.js";

const cache = new TtlCache<GameConfig>(30_000, 1);

/** Defaults overlaid with `game_config` rows (one level deep), cached 30 s per instance. */
export async function getConfig(): Promise<GameConfig> {
  return cache.getOrSet("cfg", async () => {
    const rows = await db.select().from(gameConfig);
    const merged: Record<string, unknown> = structuredClone(DEFAULT_CONFIG);
    for (const { key, value } of rows) {
      const base = merged[key];
      merged[key] =
        base && typeof base === "object" && !Array.isArray(base) && value && typeof value === "object" && !Array.isArray(value)
          ? { ...base, ...value }
          : value;
    }
    return merged as GameConfig;
  });
}

export const clearConfigCache = () => cache.clear();
