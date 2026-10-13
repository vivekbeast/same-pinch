/** Run when the main thread is idle (falls back to a timeout). Returns a cancel function. */
export function onIdle(cb: () => void, fallbackMs = 1500): () => void {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(cb);
    return () => w.cancelIdleCallback!(id);
  }
  const id = setTimeout(cb, fallbackMs);
  return () => clearTimeout(id);
}
