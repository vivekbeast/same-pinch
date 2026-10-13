// Error boundary for routes (docs/UX_STATES.md §5). A chunk that vanished after a deploy → reload once.
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { NightCard } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const isChunkError = (e: unknown) =>
  e instanceof Error &&
  /dynamically imported module|Loading chunk|Importing a module script/i.test(e.message);

export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    if (!isChunkError(error)) return;
    try {
      if (!sessionStorage.getItem("sp.reloaded")) {
        sessionStorage.setItem("sp.reloaded", "1");
        location.reload();
      }
    } catch {
      /* storage blocked: show the card */
    }
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <NightCard
        className="w-full max-w-[480px]"
        title={t("error.title")}
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="light" onClick={() => location.reload()}>
              <RotateCcw className="size-5" aria-hidden />
              {t("error.reload")}
            </Button>
            <Button variant="ghost" asChild className="text-white hover:bg-white/10">
              <Link to="/">{t("error.home")}</Link>
            </Button>
          </div>
        }
      />
    </main>
  );
}
