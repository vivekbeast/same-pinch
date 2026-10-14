// Routes (docs/UI_DIRECTION.md v2 §3). Every screen is a lazy chunk; the shell is in the main bundle.
import { createBrowserRouter, Navigate, redirect, useSearchParams } from "react-router";
import { isOnboarded, markOnboarded } from "@/lib/session";
import AppShell from "./AppShell";
import { RouteError } from "./RouteError";
import { screens } from "./screens";

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
  { path: "/terms", lazy: page(screens.terms), errorElement: <RouteError /> },
  {
    path: "/welcome",
    lazy: page(screens.welcome),
    errorElement: <RouteError />,
  },
  {
    element: <AppShell />,
    loader: firstRunGate,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: page(screens.today) },
      { path: "daily", lazy: page(screens.daily) },
      { path: "people", lazy: page(screens.people) },
      { path: "me", lazy: page(screens.me) },
      { path: "me/wallet", lazy: page(screens.wallet) },
      { path: "me/badges", lazy: page(screens.badges) },
      { path: "me/map", lazy: page(screens.map) },
      { path: "me/settings", lazy: page(screens.settings) },
      // Older paths keep working (bookmarks, the Google return-to): v1 tabs and the v2 Rewards tab (D41).
      { path: "rewards", element: <RewardsRedirect /> },
      { path: "wallet", element: <Navigate to="/me/wallet" replace /> },
      { path: "map", element: <Navigate to="/me/map" replace /> },
      { path: "pals", element: <Navigate to="/people" replace /> },
      { path: "settings", element: <Navigate to="/me/settings" replace /> },
    ],
  },
  { path: "/play/:packId", lazy: page(screens.play), errorElement: <RouteError /> },
  {
    path: "/play/:packId/done",
    lazy: page(screens.results),
    errorElement: <RouteError />,
  },
  { path: "*", lazy: page(screens.notFound) },
]);
