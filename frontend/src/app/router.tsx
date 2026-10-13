// Routes (docs/UI_DIRECTION.md v2 §3). Every screen is a lazy chunk; the shell is in the main bundle.
import { createBrowserRouter, Navigate, redirect, useSearchParams } from "react-router";
import { isOnboarded, markOnboarded } from "@/lib/session";
import AppShell from "./AppShell";
import { RouteError } from "./RouteError";

/**
 * Decides before anything renders: a first-time visitor goes straight to the practice game, so the
 * shell (nav + skeleton) never flashes. Coming back from Google sign-in counts as onboarded.
 */
function firstRunGate({ request }: { request: Request }) {
  const q = new URL(request.url).searchParams;
  if (q.has("signed_in") || q.has("linked")) markOnboarded();
  if (!isOnboarded()) throw redirect("/welcome");
  return null;
}

/** /rewards?tab=… (v2) → where that thing lives now. */
function RewardsRedirect() {
  const [q] = useSearchParams();
  const to = { badges: "/me/badges", map: "/me/map", pals: "/people" }[q.get("tab") ?? ""] ?? "/me/wallet";
  return <Navigate to={to} replace />;
}

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  // Public: readable before signing up (D45).
  { path: "/terms", lazy: page(() => import("@/features/system/Terms")), errorElement: <RouteError /> },
  {
    path: "/welcome",
    lazy: page(() => import("@/features/onboarding/Welcome")),
    errorElement: <RouteError />,
  },
  {
    element: <AppShell />,
    loader: firstRunGate,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(() => import("@/features/today/Today")) },
      { path: "daily", lazy: page(() => import("@/features/daily/Daily")) },
      { path: "people", lazy: page(() => import("@/features/pals/Pals")) },
      { path: "me", lazy: page(() => import("@/features/profile/Profile")) },
      { path: "me/wallet", lazy: page(() => import("@/features/wallet/Wallet")) },
      { path: "me/badges", lazy: page(() => import("@/features/profile/BadgesPage")) },
      { path: "me/map", lazy: page(() => import("@/features/map/MapPage")) },
      { path: "me/settings", lazy: page(() => import("@/features/settings/Settings")) },
      // Older paths keep working (bookmarks, the Google return-to): v1 tabs and the v2 Rewards tab (D41).
      { path: "rewards", element: <RewardsRedirect /> },
      { path: "wallet", element: <Navigate to="/me/wallet" replace /> },
      { path: "map", element: <Navigate to="/me/map" replace /> },
      { path: "pals", element: <Navigate to="/people" replace /> },
      { path: "settings", element: <Navigate to="/me/settings" replace /> },
    ],
  },
  { path: "/play/:packId", lazy: page(() => import("@/features/play/Play")), errorElement: <RouteError /> },
  {
    path: "/play/:packId/done",
    lazy: page(() => import("@/features/results/Results")),
    errorElement: <RouteError />,
  },
  { path: "*", lazy: page(() => import("@/features/system/NotFound")) },
]);
