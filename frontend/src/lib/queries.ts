// Read models shared by screens and the desktop context panel.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type LeaderboardScope } from "@shared";
import { api } from "./api";

export const useDaily = () =>
  useQuery({ queryKey: ["daily"], queryFn: () => api("/daily", { schema: "Daily" }) });

export const useWallet = () =>
  useQuery({ queryKey: ["wallet"], queryFn: () => api("/wallet", { schema: "Wallet" }) });

export const useLedger = () =>
  useInfiniteQuery({
    queryKey: ["ledger"],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      api(`/wallet/ledger?limit=20${pageParam ? `&cursor=${pageParam}` : ""}`, { schema: "LedgerPage" }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const usePayouts = () =>
  useQuery({ queryKey: ["payouts"], queryFn: () => api("/wallet/payouts", { schema: "PayoutList" }) });

export const useMap = () =>
  useQuery({ queryKey: ["map"], queryFn: () => api("/map", { schema: "MapResponse" }) });

export const useLeaderboard = (scope: LeaderboardScope) =>
  useQuery({
    queryKey: ["leaderboard", scope],
    queryFn: () => api(`/leaderboard?scope=${scope}`, { schema: "Leaderboard" }),
  });

export const useBadges = () =>
  useQuery({ queryKey: ["badges"], queryFn: () => api("/me/badges", { schema: "MeBadges" }) });

/** People you've shared a moment with (D44). */
export const usePeople = () => useQuery({ queryKey: ["people"], queryFn: () => api("/people", { schema: "PeopleResponse" }) });

/** Pinch Notes inbox (D48). Polled gently so the People tab dot stays fresh. */
export const useNotes = () =>
  useQuery({
    queryKey: ["notes"],
    queryFn: () => api("/notes", { schema: "NotesResponse" }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
