// The signed-in frame. Exactly one navigation renders per device family (docs/DECISIONS.md D2);
// tablet/desktop pieces are lazy chunks phones never download.
import { CloudOff } from "lucide-react";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "@/lib/toast";
import { BottomNav } from "@/components/shell/BottomNav";
import { InlineError } from "@/components/states";
import { Skeleton } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import { currentLang, setLang, t, type Key } from "@/lib/i18n";
import { useOnline } from "@/lib/online";
import { syncPrefs } from "@/lib/prefs";
import { queryClient } from "@/lib/query";
import { forgetOnboarding, meKey, useMe } from "@/lib/session";
import { useFamily } from "@/lib/use-family";

const NavRail = lazy(() => import("@/components/shell/NavRail"));

/** Toasts for the Google redirect flags (?signed_in, ?linked, ?auth_error), then clean the URL. */
function useAuthFlags() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const q = new URLSearchParams(search);
    const err = q.get("auth_error");
    const ok = q.get("signed_in") ? "auth.signed_in" : q.get("linked") ? "auth.linked" : null;
    if (!err && !ok) return;
    if (err) toast.error(t(`auth.${err}` as Key));
    if (ok) {
      toast.success(t(ok as Key));
      void queryClient.invalidateQueries({ queryKey: meKey });
    }
    ["auth_error", "signed_in", "linked"].forEach((k) => q.delete(k));
    navigate({ pathname, search: q.toString() }, { replace: true });
  }, [search, pathname, navigate]);
}

function ShellSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-220 flex-col gap-6" aria-busy="true">
      <Skeleton className="h-11 w-48" />
      <Skeleton className="h-52 rounded-card bg-night/10" />
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-28 rounded-card" />
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const settings = me.data?.settings;
  const uiLang = me.data?.uiLang;
  // The server is the source of truth for play settings and UI language (docs/ARCHITECTURE.md §4).
  useEffect(() => {
    if (settings) syncPrefs(settings);
  }, [settings]);
  useEffect(() => {
    if (uiLang && uiLang !== currentLang()) void setLang(uiLang);
  }, [uiLang]);
  if (me.isPending) return <ShellSkeleton />;
  if (me.error) {
    if (me.error instanceof ApiError && me.error.code === "UNAUTHENTICATED") {
      // Session gone (expired, logged out elsewhere, deleted): back to /welcome — restore is one tap there.
      forgetOnboarding();
      return <Navigate to="/welcome" replace />;
    }
    return <InlineError error={me.error} onRetry={() => me.refetch()} />;
  }
  return children;
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="status"
      className="mx-auto mb-4 flex w-full max-w-220 items-center gap-3 rounded-tile bg-marigold-soft px-4 py-2.5 text-[15px] font-bold text-ink pop-sm"
    >
      <CloudOff className="size-5 shrink-0" aria-hidden />
      {t("offline.banner")}
    </p>
  );
}

export default function AppShell() {
  const family = useFamily();
  useAuthFlags();
  return (
    <div className="flex min-h-dvh">
      {/* Tablet + desktop share the floating dock; phones get the bottom dock (D41). */}
      <Suspense fallback={null}>{family === "phone" ? null : <NavRail />}</Suspense>
      <main className="min-w-0 flex-1 px-4 pt-4 pb-32 sm:px-6 md:px-6 md:pt-8 md:pb-12 lg:px-8 xl:px-10 xl:pt-10">
        <OfflineBanner />
        <AuthGate>
          <Outlet />
        </AuthGate>
      </main>
      {family === "phone" ? <BottomNav /> : null}
    </div>
  );
}

export { ShellSkeleton };
