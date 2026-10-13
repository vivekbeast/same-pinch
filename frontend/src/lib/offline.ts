// Offline play (docs/ARCHITECTURE.md §4). IndexedDB via Dexie: stored packs (play without signal) and
// the answer queue (every round is written here BEFORE it's sent, so nothing is ever lost).
// Imported lazily — Dexie never weighs on the first screen.
import Dexie, { type EntityTable } from "dexie";
import { api as contract, LIMITS, type z } from "@shared";
import { api, ApiError } from "./api";
import { saveRoundResult } from "./round-store";

type Pack = z.infer<typeof contract.Pack>;
type Result = z.infer<typeof contract.RoundResultResponse>;
type RoundBody = z.input<typeof contract.SubmitRoundInput>;

export interface StoredPack {
  packId: string;
  pack: Pack;
  savedAt: number;
}

export interface QueuedRound {
  attemptId: string;
  packId: string;
  promptId: string;
  index: number;
  kind: string;
  textKey: string;
  body: RoundBody;
  createdAt: number;
}

const db = new Dexie("samepinch") as Dexie & {
  packs: EntityTable<StoredPack, "packId">;
  queue: EntityTable<QueuedRound, "attemptId">;
};
db.version(1).stores({ packs: "packId, savedAt", queue: "attemptId, packId, createdAt" });
// v2 (D45): packs saved before packs became 5 rounds are dropped; the server has trimmed them, and Play
// refetches the trimmed copy. The answer queue is untouched — nothing a player did is lost.
db.version(2)
  .stores({ packs: "packId, savedAt", queue: "attemptId, packId, createdAt" })
  .upgrade((tx) =>
    tx
      .table("packs")
      .filter((p: StoredPack) => p.pack.rounds.length > LIMITS.packSize)
      .delete(),
  );

// ---------- Packs ----------
export const storePack = (pack: Pack) => db.packs.put({ packId: pack.packId, pack, savedAt: Date.now() });
export const getStoredPack = async (packId: string) => (await db.packs.get(packId))?.pack ?? null;
export const forgetPack = (packId: string) => db.packs.delete(packId);
/** Stored packs, oldest first. An over-long (pre-D40) pack never comes back from here. */
export const storedPacks = async () =>
  (await db.packs.orderBy("savedAt").toArray()).filter((p) => p.pack.rounds.length <= LIMITS.packSize);

/** A stored pack with rounds still to play (prefetched for offline). */
export async function nextReadyPack(): Promise<Pack | null> {
  const queued = await db.queue.toArray();
  for (const { pack } of await storedPacks()) {
    const done = new Set([
      ...pack.answered,
      ...queued.filter((q) => q.packId === pack.packId).map((q) => q.promptId),
    ]);
    if (pack.rounds.some((r) => !done.has(r.promptId))) return pack;
  }
  return null;
}

/** The service worker's runtime cache for prompt photos (vite.config.ts → workbox runtimeCaching). */
export const PHOTO_CACHE = "prompts";

/**
 * Put a pack's photos straight into the service worker's photo cache so the pack plays offline. Uses the
 * Cache API directly: works even on the very first visit, before the worker controls the page.
 */
export async function warmAssets(pack: Pack, small: boolean) {
  const urls = pack.rounds.flatMap((r) =>
    r.asset ? [small ? r.asset.src.replace("-480.", "-320.") : r.asset.src] : [],
  );
  if (!("caches" in window)) {
    for (const u of urls) void fetch(u).catch(() => undefined);
    return;
  }
  const cache = await caches.open(PHOTO_CACHE);
  await Promise.all(urls.map(async (u) => (await cache.match(u)) ?? cache.add(u).catch(() => undefined)));
}

// ---------- Answer queue ----------
export const enqueue = (q: QueuedRound) => db.queue.put(q);
export const dequeue = (attemptId: string) => db.queue.delete(attemptId);
export const queuedFor = (packId: string) => db.queue.where("packId").equals(packId).toArray();
export const queueSize = () => db.queue.count();

let flushing: Promise<{ sent: QueuedRound[]; results: Result[] }> | null = null;

/**
 * Send everything waiting, oldest first. Stops at the first network/server failure (try again later);
 * drops rounds the server permanently refuses (e.g. STALE_ROUND after 48 h). Idempotent server-side.
 */
export function flushQueue() {
  flushing ??= (async () => {
    const sent: QueuedRound[] = [];
    const results: Result[] = [];
    try {
      for (const q of await db.queue.orderBy("createdAt").toArray()) {
        try {
          const res = await api("/rounds", { method: "POST", body: q.body, schema: "RoundResultResponse" });
          saveRoundResult(q.packId, q.index, {
            promptId: q.promptId,
            kind: q.kind,
            textKey: q.textKey,
            result: res,
          });
          await dequeue(q.attemptId);
          sent.push(q);
          results.push(res);
        } catch (e) {
          if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.code !== "RATE_LIMITED")
            await dequeue(q.attemptId);
          else break;
        }
      }
    } finally {
      flushing = null;
    }
    return { sent, results };
  })();
  return flushing;
}

export async function clearOfflineData() {
  await db.packs.clear();
  await db.queue.clear();
}
