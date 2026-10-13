// Prompt picture/question. Fixed aspect box, no layout shift; if the image fails → a neutral tile
// with a Skip (no penalty) — docs/UX_STATES.md §4. Alt text is deliberately empty in play: a full
// description would give the answer away (docs/ACCESSIBILITY.md).
import { ImageOff, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import type { api, z } from "@shared";
import { cn } from "@/lib/cn";
import { t, tk } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

type Round = z.infer<typeof api.Round>;

export function PromptMedia({
  round,
  className,
  onSkip,
}: {
  round: Round;
  className?: string;
  onSkip?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const saver = usePrefs((p) => p.dataSaver);

  if (round.kind === "question" || !round.asset) {
    return (
      <div
        className={cn(
          "relative flex flex-col justify-end overflow-hidden rounded-tile bg-brand p-6 text-white pop md:p-8",
          className,
        )}
      >
        <MessageCircleQuestion
          className="absolute top-5 right-5 size-14 text-marigold"
          strokeWidth={2.25}
          aria-hidden
        />
        <p className="text-[clamp(30px,6vw,52px)] leading-[1.02] font-black text-balance">
          {tk(round.textKey, round.textParams ?? undefined)}
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-tile bg-surface-2 p-6 text-ink-muted pop",
          className,
        )}
      >
        <ImageOff className="size-10" strokeWidth={1.5} aria-hidden />
        <p className="font-medium">{t("play.image_failed")}</p>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-full bg-surface px-4 py-2 text-[15px] font-semibold text-brand pop-sm"
          >
            {t("common.next")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-tile bg-surface-2 pop", className)}>
      <img
        src={saver ? round.asset.src.replace("-480.", "-320.") : round.asset.src}
        srcSet={saver ? undefined : round.asset.srcset}
        sizes="(min-width: 1280px) 520px, (min-width: 768px) 56vw, 100vw"
        alt=""
        aria-label={t("prompt.what_do_you_see")}
        width={720}
        height={720}
        decoding="async"
        fetchPriority="high"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </div>
  );
}
