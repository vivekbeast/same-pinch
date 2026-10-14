// First-party analytics only (docs/ARCHITECTURE.md §9): fire-and-forget POST /events. Never words,
// UPI ids or anything personal in props. Dropped silently when offline.
import type { EventName } from "@shared";
import { api } from "./api";
import { queryClient } from "./query";

type Props = Record<string, string | number | boolean>;

// Events are tied to a player, so the API refuses them before sign-up (401). Hold the first few (welcome,
// practice) in memory instead, and send them with the first event after sign-in: no failed requests, no
// console errors, and the onboarding funnel still arrives.
const pending: { name: EventName; props?: Props }[] = [];
const signedIn = () => queryClient.getQueryData(["me"]) !== undefined;

export function track(name: EventName, props?: Props) {
  if (!navigator.onLine) return;
  if (!signedIn()) {
    if (pending.length < 20) pending.push({ name, props });
    return;
  }
  for (const e of [...pending.splice(0), { name, props }])
    void api("/events", { method: "POST", body: e }).catch(() => undefined);
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
