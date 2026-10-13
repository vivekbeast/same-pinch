// 404 — "That's a miss" (docs/UX_STATES.md §5): a sad Chutki, three bubbles saying "no", a way home.
import { useEffect } from "react";
import { Link } from "react-router";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { WordBubble } from "@/components/words";
import { t } from "@/lib/i18n";

export default function NotFound() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    document.title = `${t("notfound.title")} · Same Pinch`;
    return () => meta.remove();
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center p-5">
      <section className="flex w-full max-w-[480px] flex-col items-center gap-5 rounded-card bg-surface p-7 text-center pop">
        <p className="text-[96px] leading-none font-black text-pinch" aria-label="404">
          404
        </p>
        <Mascot pose="sad" size={110} />
        <div className="flex flex-wrap justify-center gap-2 pb-2" aria-hidden>
          <WordBubble word="miss" lang="en" size="sm" />
          <WordBubble word="नहीं" lang="hi" size="sm" />
          <WordBubble word="ಇಲ್ಲ" lang="kn" size="sm" side="right" />
        </div>
        <div>
          <h1 className="text-title font-black">{t("notfound.title")}</h1>
          <p className="mt-1 font-semibold text-ink-muted">{t("notfound.sub")}</p>
        </div>
        <Button variant="play" block asChild>
          <Link to="/">{t("notfound.home")}</Link>
        </Button>
      </section>
    </main>
  );
}
