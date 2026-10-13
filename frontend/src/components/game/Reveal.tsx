// THE moment (docs/UI_DIRECTION.md v2 §2): both cards flip together, matched words turn mint, a comic
// "SAME PINCH!" burst pops with confetti, the stage shakes and a coin pops up. Misses get a soft wobble
// and a sad Chutki — never shame. Reduced motion: no shake, no confetti; the burst simply appears.
import { m, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import { useEffect } from "react";
import { REGIONS, type api, type z } from "@shared";
import { Confetti, PinchStamp } from "@/components/stamp";
import { WordBubble } from "@/components/words";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { sound } from "@/lib/sound";
import { t } from "@/lib/i18n";
import { ease, spring } from "@/lib/motion";

type Result = z.infer<typeof api.RoundResultResponse>;
const stateName = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? "";

function Face({
  title,
  sub,
  children,
  tone = "you",
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  tone?: "you" | "partner";
}) {
  return (
    <div
      className={cn(
        "flex min-h-[170px] flex-col gap-3 rounded-tile p-3.5 pop md:p-5",
        tone === "you" ? "bg-surface" : "bg-sky-soft",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[18px] font-black text-ink">{title}</p>
        {sub ? <p className="truncate text-[14px] font-bold text-ink-muted">{sub}</p> : null}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-3">{children}</div>
    </div>
  );
}

/** A pinch with no words: say so, instead of an empty card. */
function NoWords() {
  return <span className="text-[14px] font-bold text-ink-muted">{t("play.pinched_only")}</span>;
}

function SealedFace({ title }: { title: string }) {
  return (
    <div className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-tile bg-night p-4 text-white pop">
      <Lock className="size-7 text-marigold" strokeWidth={2.5} aria-hidden />
      <p className="max-w-full truncate text-[18px] font-black">{title}</p>
      <p className="text-center text-[14px] font-bold text-white/65">{t("play.partner_sealed")}</p>
    </div>
  );
}

/** One flip card. Sealed until `revealed`, then rotates to its back face. */
function FlipCard({
  revealed,
  front,
  back,
  wobble,
}: {
  revealed: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  wobble?: boolean;
}) {
  return (
    <div className={cn("[perspective:900px]", wobble && "animate-wobble")}>
      <m.div
        className="relative [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.45, ease: ease.inOut }}
      >
        <div className="[backface-visibility:hidden]">{front}</div>
        <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
          {back}
        </div>
      </m.div>
    </div>
  );
}

export function Reveal({
  result,
  myWords,
  revealed,
  myName,
}: {
  result: Result | null;
  myWords: { text: string; lang: z.infer<typeof api.Lang> }[];
  revealed: boolean;
  myName: string;
}) {
  const r = result;
  const pinch = r && (r.result === "exact" || r.result === "bhasha");
  // Pinch the Picture (D39): your eyes met even if your words didn't — that's a moment, not a miss.
  const sameSpot = !!r?.spot?.same;
  const still = useReducedMotion();

  useEffect(() => {
    if (!revealed || !r) return;
    if (pinch || sameSpot) {
      haptic.pinch();
      sound.pinch();
    } else if (r.result === "miss") {
      haptic.miss();
      sound.miss();
    }
  }, [revealed, r, pinch, sameSpot]);

  const you = r?.you ?? myWords.map((w) => ({ ...w, matched: false, burnt: false }));
  const youFace = (
    <Face title={t("play.you")} sub={myName}>
      {!you.length && r?.spot ? <NoWords /> : null}
      {you.map((w) => (
        <WordBubble
          key={w.text}
          word={w.text}
          lang={w.lang}
          size="sm"
          state={w.burnt ? "burnt" : revealed && w.matched ? "matched" : "idle"}
        />
      ))}
    </Face>
  );
  const partnerFace = r?.partner ? (
    <Face title={r.partner.handle} sub={stateName(r.partner.stateCode)} tone="partner">
      {!r.partner.words.length ? <NoWords /> : null}
      {r.partner.words.map((w) => (
        <WordBubble
          key={w.text}
          word={w.text}
          lang={w.lang}
          size="sm"
          side="right"
          state={w.matched ? "matched" : "partner"}
        />
      ))}
    </Face>
  ) : (
    // No partner on a played round = nobody has answered this photo yet (D44). Say so, kindly.
    <Face title={r && r.result !== "skipped" ? t("play.first_here") : t("play.reveal.skipped")} tone="partner">
      {null}
    </Face>
  );

  return (
    <m.div
      className="relative"
      animate={revealed && pinch && !still ? { x: [0, -6, 6, -4, 3, 0], y: [0, 3, -3, 2, 0, 0] } : undefined}
      transition={{ duration: 0.4, delay: 0.42 }}
    >
      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {/* "You" is face-up from the start; it does a matching half-turn for rhythm. */}
        <FlipCard revealed={revealed} front={youFace} back={youFace} />
        <FlipCard
          revealed={revealed}
          front={<SealedFace title={r?.partner?.handle ?? "…"} />}
          back={partnerFace}
          wobble={revealed && r?.result === "miss"}
        />
      </div>

      {revealed && r && pinch ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          {!still ? <Confetti /> : null}
          <PinchStamp
            variant={r.result === "bhasha" ? "bhasha" : "exact"}
            label={t(r.result === "bhasha" ? "play.reveal.bhasha" : "play.reveal.exact")}
            className="min-h-[150px] min-w-[290px] md:min-h-[170px]"
          />
        </div>
      ) : null}

      {revealed && r ? (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: pinch ? 0.45 : 0.15, ...spring.soft }}
          className="mt-4 flex items-center gap-3"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            <p className={cn("text-[22px] leading-tight font-black", pinch || sameSpot ? "text-ink" : "text-ink-2")}>
              {pinch
                ? r.partner
                  ? t("play.partner_from", {
                      handle: r.partner.handle,
                      state: stateName(r.partner.stateCode),
                    })
                  : ""
                : !r.partner
                  ? t("play.first_here_sub")
                  : sameSpot
                    ? t("play.same_spot")
                    : t(`play.reveal.${r.result}`)}
            </p>
            {pinch && sameSpot ? (
              <span className="tilt-l rounded-full bg-lime px-3 py-1 text-[15px] font-black text-ink">
                {t("play.same_spot_chip")}
              </span>
            ) : null}
          </div>
        </m.div>
      ) : null}
    </m.div>
  );
}
