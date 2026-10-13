// First-party analytics only (docs/ARCHITECTURE.md §9): fire-and-forget POST /events. Never words,
// UPI ids or anything personal in props. Dropped silently when offline.
import type { EventName } from "@shared";
import { api } from "./api";

export function track(name: EventName, props?: Record<string, string | number | boolean>) {
  if (!navigator.onLine) return;
  void api("/events", { method: "POST", body: { name, props } }).catch(() => undefined);
}

/** Core Web Vitals from real devices, sampled at 20% (docs/PERFORMANCE.md §5). Loaded on idle. */
export function trackVitals() {
  if (Math.random() > 0.2) return;
  void import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
    const send = (m: { name: string; value: number; rating: string }) =>
      track("vitals", { metric: m.name, value: Math.round(m.value * 1000) / 1000, rating: m.rating });
    onLCP(send);
    onCLS(send);
    onINP(send);
    onFCP(send);
    onTTFB(send);
  });
}
