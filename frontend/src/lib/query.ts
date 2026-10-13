import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ApiError } from "./api";

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // A session that expired mid-use: let Me re-establish it (docs/ARCHITECTURE.md §8).
    onError: (e, query) => {
      if (e instanceof ApiError && e.code === "UNAUTHENTICATED" && query.queryKey[0] !== "me") {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      }
    },
  }),
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 30_000,
      gcTime: 24 * 3_600_000,
      refetchOnWindowFocus: true,
      // Retry network blips and 5xx twice; never retry 4xx (they won't change).
      retry: (count, e) => count < 2 && (!(e instanceof ApiError) || e.status === 0 || e.status >= 500),
    },
    mutations: { networkMode: "offlineFirst", retry: false },
  },
});

/** What survives a reload / opens offline: the player's own read models (docs/ARCHITECTURE.md §4). */
const PERSISTED = new Set([
  "me",
  "config",
  "daily",
  "map",
  "wallet",
  "ledger",
  "payouts",
  "badges",
  "leaderboard",
  "words", // Smart Chips work offline
  "people",
]);

export const persister = createSyncStoragePersister({
  storage: typeof window === "undefined" ? undefined : window.localStorage,
  key: "sp.cache",
  throttleTime: 1_000,
});

export const persistOptions = {
  persister,
  maxAge: 24 * 3_600_000,
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { queryKey: readonly unknown[]; state: { status: string } }) =>
      q.state.status === "success" && PERSISTED.has(String(q.queryKey[0])),
  },
};

/** Logout / delete: forget everything cached for this player. */
export async function forgetPlayer() {
  queryClient.clear();
  await persister.removeClient();
  const { clearOfflineData } = await import("./offline");
  await clearOfflineData();
}
