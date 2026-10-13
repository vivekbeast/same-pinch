// Reward moments (docs/UI_DIRECTION.md v2 §3): numbers count up, then each reward pops in its own
// modal, one after the other. Lives in animated screens only (Motion comes with them).
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Confetti } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { spring } from "@/lib/motion";

/** Counts 0 → value over ~0.9 s (ease-out). Reduced motion: shows the value at once. */
export function useCountUp(value: number, run = true) {
  const still = useReducedMotion();
  const [n, setN] = useState(still || !run ? value : 0);
  useEffect(() => {
    if (still || !run) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 900);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, run, still]);
  return still || !run ? value : n;
}

export interface Reward {
  id: string;
  art: ReactNode;
  title: string;
  sub?: string;
  tone?: "brand" | "pinch" | "marigold" | "success";
}

/** Shows rewards one at a time; calls onDone after the last. */
export function RewardQueue({ rewards, onDone }: { rewards: Reward[]; onDone?: () => void }) {
  const [i, setI] = useState(0);
  const still = useReducedMotion();
  const btn = useRef<HTMLButtonElement>(null);
  const r = rewards[i];
  useEffect(() => {
    if (r) btn.current?.focus({ preventScroll: true });
  }, [r]);
  useEffect(() => {
    if (rewards.length && i >= rewards.length) onDone?.();
  }, [i, rewards.length, onDone]);

  return (
    <AnimatePresence>
      {r ? (
        <m.div
          key="veil"
          className="fixed inset-0 z-[70] grid place-items-center bg-night/70 p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reward-title"
        >
          <m.div
            key={r.id}
            initial={still ? { opacity: 0 } : { scale: 0.5, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={spring.bouncy}
            className={cn(
              "relative flex w-full max-w-[360px] flex-col items-center gap-3 rounded-card p-6 text-center pop",
              {
                brand: "bg-brand text-white",
                pinch: "bg-pinch text-ink",
                marigold: "bg-marigold text-ink",
                success: "bg-success-bright text-ink",
              }[r.tone ?? "brand"],
            )}
          >
            {!still ? <Confetti pieces={14} /> : null}
            <div className="relative">{r.art}</div>
            <h2 id="reward-title" className="text-[30px] leading-tight font-black">
              {r.title}
            </h2>
            {r.sub ? <p className="text-[17px] font-bold opacity-85">{r.sub}</p> : null}
            <Button ref={btn} variant="light" size="lg" block onClick={() => setI(i + 1)} className="mt-2">
              {i < rewards.length - 1 ? t("common.next") : t("rewards.nice")}
            </Button>
            <span className="text-[13px] font-bold opacity-70">
              {i + 1}/{rewards.length}
            </span>
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
