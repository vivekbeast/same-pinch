/** Tiny per-instance TTL cache (sessions, leaderboard, config). Instances are stateless; this is only a speed-up. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>();
  constructor(
    private ttlMs: number,
    private maxEntries = 5_000,
  ) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlMs = this.ttlMs) {
    if (this.store.size >= this.maxEntries) this.store.delete(this.store.keys().next().value!);
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.store.delete(key);
  }

  deleteWhere(pred: (value: V) => boolean) {
    for (const [k, v] of this.store) if (pred(v.value)) this.store.delete(k);
  }

  clear() {
    this.store.clear();
  }

  async getOrSet(key: string, load: () => Promise<V>, ttlMs?: number): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await load();
    this.set(key, value, ttlMs);
    return value;
  }
}
