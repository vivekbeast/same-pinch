// The pack, dealt back as cards (D55): one card per round lands face-down and flips over in 3D, one after
// another, showing the round's photo and how it went — PINCH, Bhasha, same spot or miss. Transform and
// opacity only; with reduced motion the cards simply fade in face-up (MotionConfig drops the transforms).
import { m } from "motion/react";
import type { api, z } from "@shared";
import { PinchGlyph } from "@/components/brand";
import { cn } from "@/lib/cn";
import { t, tk } from "@/lib/i18n";
import { queryClient } from "@/lib/query";
import type { StoredRound } from "@/lib/round-store";

type Pack = z.infer<typeof api.Pack>;
type Outcome = "bhasha" | "exact" | "spot" | "miss" | "skip";

function outcome(r: StoredRound): Outcome {
  const res = r.result.result;
  if (res === "bhasha" || res === "exact") return res;
  if (r.result.spot?.same) return "spot";
  return res === "skipped" ? "skip" : "miss";
}

const STAMP: Record<Outcome, string> = {
  bhasha: "bg-bubble text-ink",
  exact: "bg-lime text-ink",
  spot: "bg-sky text-ink",
  miss: "bg-surface text-ink-2",
  skip: "bg-surface text-ink-muted",
};

export function RoundRecap({ packId, rounds }: { packId: string; rounds: StoredRound[] }) {
  // Photos come from the pack Play already holds; without it a card shows the prompt text instead.
  const pack = queryClient.getQueryData<Pack>(["pack", packId]);
  const assetFor = (promptId: string) =>
    pack?.rounds.find((r) => r.promptId === promptId)?.asset?.src ?? null;

  return (
    <ol
      className="grid grid-cols-5 gap-2 perspective-[1000px] sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4"
      aria-label={t("results.recap")}
    >
      {rounds.map((r, i) => {
        const kind = outcome(r);
        const src = assetFor(r.promptId);
        return (
          <li key={r.promptId} className="aspect-[3/4]">
            <m.div
              className="relative size-full transform-3d"
              initial={{ rotateY: 180, y: 28, opacity: 0 }}
              animate={{ rotateY: 0, y: 0, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.14, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Face: the round's photo (or its prompt) with the result stamped on. */}
              <div
                className={cn(
                  "absolute inset-0 flex flex-col justify-end overflow-hidden rounded-tile p-1.5 pop-sm backface-hidden md:p-2",
                  src ? "bg-night" : "bg-brand-soft",
                )}
              >
                {src ? (
                  <img
                    src={src.replace("-480.", "-320.")}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : null}
                {!src ? (
                  <span className="absolute inset-x-2 top-2 line-clamp-3 text-[12px] leading-tight font-black text-brand-ink md:text-[13px]">
                    {tk(r.textKey)}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "relative -rotate-3 self-center rounded-full px-2 py-0.5 text-center text-[11px] leading-tight font-black whitespace-nowrap pop-sm md:px-3 md:text-[13px]",
                    STAMP[kind],
                  )}
                >
                  {t(`results.card.${kind}`)}
                </span>
              </div>
              {/* Back: what you see before it flips. */}
              <div className="absolute inset-0 grid transform-[rotateY(180deg)] place-items-center rounded-tile bg-night backface-hidden">
                <PinchGlyph className="size-8 md:size-10" />
              </div>
            </m.div>
          </li>
        );
      })}
    </ol>
  );
}
