// Things that run for the whole app, outside any screen:
//  • send queued offline rounds when the connection returns (and tell the player what came back)
//  • "New version ready" when a new service worker is waiting (never reloads mid-pack)
//  • the one-time "Add to home screen" sheet
//  • app_open + sampled web-vitals
import { useEffect } from "react";
import { toast } from "@/lib/toast";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { track, trackVitals } from "@/lib/events";
import { t, tn } from "@/lib/i18n";
import { promptInstall, useInstall } from "@/lib/install";
import { onIdle } from "@/lib/idle";
import { queryClient } from "@/lib/query";

let flushing = false;

/** Send queued rounds. Reconnect + tab focus can fire together: only the call that starts a flush announces it. */
async function flush() {
  if (!navigator.onLine || flushing) return;
  flushing = true;
  try {
    await flushOnce();
  } finally {
    flushing = false;
  }
}

async function flushOnce() {
  const { flushQueue } = await import("@/lib/offline");
  const { sent, results } = await flushQueue();
  if (!sent.length) return;
  const pinches = results.filter((r) => r.result === "exact" || r.result === "bhasha").length;
  toast.success(tn("sync.results", sent.length), {
    description: pinches ? t("sync.pinches", { n: pinches }) : undefined,
  });
  for (const packId of new Set(sent.map((s) => s.packId)))
    void queryClient.invalidateQueries({ queryKey: ["queue", packId] });
  void queryClient.invalidateQueries({ queryKey: ["me"] });
}

function useSync() {
  useEffect(() => {
    void flush();
    const onVisible = () => document.visibilityState === "visible" && void flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}

/** Register the service worker when idle; a waiting update asks first — never reloads mid-pack. */
function useServiceWorker() {
  useEffect(
    () =>
      onIdle(() => {
        void import("virtual:pwa-register").then(({ registerSW }) => {
          const update = registerSW({
            immediate: true,
            onNeedRefresh: () =>
              toast(t("update.ready"), {
                duration: Infinity,
                action: { label: t("update.refresh"), onClick: () => void update(true) },
              }),
          });
        });
      }),
    [],
  );
}

function InstallSheet() {
  const open = useInstall((s) => s.open);
  const setOpen = useInstall((s) => s.setOpen);
  return (
    <Sheet open={open} onOpenChange={setOpen} title={t("install.title")} description={t("install.sub")}>
      <div className="flex flex-col gap-3 md:flex-row">
        <Button
          onClick={async () => {
            setOpen(false);
            if (await promptInstall()) track("install_accept");
          }}
        >
          {t("install.cta")}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("install.later")}
        </Button>
      </div>
    </Sheet>
  );
}

export function Background() {
  useSync();
  useServiceWorker();
  useEffect(() => {
    try {
      if (sessionStorage.getItem("sp.opened")) return;
      sessionStorage.setItem("sp.opened", "1");
    } catch {
      /* ignore */
    }
    return onIdle(() => {
      track("app_open");
      trackVitals();
    });
  }, []);
  return <InstallSheet />;
}
