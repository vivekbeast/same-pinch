// Three coach marks on Home, once, right after the practice game (docs/UI_DIRECTION.md v3 §3):
// PLAY → today's challenge → the Me tab (wallet, badges, map). A spotlight cut-out + Chutki in a speech bubble. Esc/skip ends it.
import { useEffect, useLayoutEffect, useState } from "react";
import { Coach } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { t, type Key } from "@/lib/i18n";
import { finishTour, tourPending } from "@/lib/tour";

const STEPS: { target: string; text: Key }[] = [
  { target: "play-hero", text: "tour.play" },
  { target: "daily", text: "tour.daily" },
  { target: "tab-me", text: "tour.coins" },
];

/** Tracks the target's box. A target that isn't on screen (yet) gets one short retry, then `onMissing`. */
function useRect(selector: string, active: boolean, onMissing: () => void) {
  // Tagged with its selector, so a box measured for the previous step is never shown for this one.
  const [box, setBox] = useState<{ sel: string; rect: DOMRect } | null>(null);
  const setRect = (rect: DOMRect) => setBox({ sel: selector, rect });
  useLayoutEffect(() => {
    if (!active) return;
    const find = () => document.querySelector<HTMLElement>(`[data-tour="${selector}"]`);
    const el = find();
    if (!el) {
      // e.g. the Daily tile is still a skeleton; a removed element must never freeze the tour.
      const id = setTimeout(() => (find() ? setRect(find()!.getBoundingClientRect()) : onMissing()), 500);
      return () => clearTimeout(id);
    }
    el.scrollIntoView({ block: "nearest" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    addEventListener("resize", update);
    addEventListener("scroll", update, true);
    return () => {
      removeEventListener("resize", update);
      removeEventListener("scroll", update, true);
    };
  }, [selector, active]); // eslint-disable-line react-hooks/exhaustive-deps -- onMissing is a fresh closure each render
  return box?.sel === selector ? box.rect : null;
}

export default function Tour() {
  const [step, setStep] = useState(() => (tourPending() ? 0 : -1));
  const active = step >= 0 && step < STEPS.length;
  const current = STEPS[Math.max(0, Math.min(step, STEPS.length - 1))]!;
  const end = () => {
    finishTour();
    setStep(-1);
  };
  const rect = useRect(current.target, active, () => (step >= STEPS.length - 1 ? end() : setStep(step + 1)));
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active]);

  if (!active || !rect) return null;
  const pad = 8;
  const below = rect.top + rect.height / 2 < innerHeight / 2;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={t("tour.label")}>
      {/* Spotlight: a hole around the target, everything else dimmed. */}
      <div
        aria-hidden
        className="absolute rounded-[30px] border-[3px] border-lime transition-all duration-300 ease-out-soft"
        style={{
          left: rect.left - pad,
          top: rect.top - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgb(27 21 48 / 0.72)",
        }}
      />
      <div
        className="absolute inset-x-0 mx-auto flex w-full max-w-[440px] flex-col gap-3 px-4"
        style={below ? { top: rect.bottom + pad + 12 } : { bottom: innerHeight - rect.top + pad + 12 }}
      >
        <Coach pose={last ? "cheer" : "idle"}>{t(STEPS[step]!.text)}</Coach>
        <div className="flex items-center justify-between gap-3 pl-2">
          <button
            type="button"
            onClick={end}
            className="cursor-pointer font-extrabold text-white/85 underline-offset-4 hover:underline"
          >
            {t("onboarding.skip")}
          </button>
          <span className="flex items-center gap-3">
            <span className="text-[14px] font-bold text-white/70">
              {step + 1}/{STEPS.length}
            </span>
            <Button variant="play" size="md" onClick={() => (last ? end() : setStep(step + 1))}>
              {last ? t("tour.done") : t("common.next")}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
