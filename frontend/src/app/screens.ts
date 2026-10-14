// Every lazy screen's import, in one place: the router loads them, and nav controls call preload() on
// hover / press / focus, so the chunk is usually in memory before the click completes.
export const screens = {
  terms: () => import("@/features/system/Terms"),
  welcome: () => import("@/features/onboarding/Welcome"),
  today: () => import("@/features/today/Today"),
  daily: () => import("@/features/daily/Daily"),
  people: () => import("@/features/pals/Pals"),
  me: () => import("@/features/profile/Profile"),
  wallet: () => import("@/features/wallet/Wallet"),
  badges: () => import("@/features/profile/BadgesPage"),
  map: () => import("@/features/map/MapPage"),
  settings: () => import("@/features/settings/Settings"),
  play: () => import("@/features/play/Play"),
  results: () => import("@/features/results/Results"),
  notFound: () => import("@/features/system/NotFound"),
};

const byPath: Record<string, keyof typeof screens> = {
  "/": "today",
  "/daily": "daily",
  "/people": "people",
  "/me": "me",
  "/play": "play",
};

/** Warm a screen's chunk. Safe to call repeatedly: the module loader caches it. Failures are ignored —
 *  the real navigation retries and shows the route error if it still fails. */
export function preload(path: string) {
  const name = byPath[path];
  if (name) screens[name]().catch(() => {});
}
