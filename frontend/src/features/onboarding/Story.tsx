// The welcome as a short motion story (docs/DECISIONS.md D46–D47, D50). Two scenes on one big photo that fills
// almost the whole phone height, with a "camera" moving over it and the caption sitting on the picture —
// like a video, not a deck of cards. Built from the game's own pieces (no video file: instant, offline,
// translatable). Controls: small progress dots bottom-centre, tap right/left for next/back, pause, skip,
// replay. Reduced motion: no auto-advance and no camera moves; scenes are stepped through with Next.
import { AnimatePresence, m, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import { Hand, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/plates";
import { Confetti, PinchStamp } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { WordBubble } from "@/components/words";
import { cn } from "@/lib/cn";
import { t, type Key } from "@/lib/i18n";
import { spring } from "@/lib/motion";

// Scene 1 is the whole core loop in one take (two strangers → push in → tap → same spot), so it runs longer.
const SCENE_MS = [6200, 3800];
const PUSH_AT = 1.8; // s into scene 1: the pills have landed; the camera pushes in on the kite
// Clean, single-subject photo only (owner: "less messy"): one kite on a plain blue sky.
const HERO = { src: "/prompts/kites-sky-720.webp", srcSet: "/prompts/kites-sky-480.webp 480w, /prompts/kites-sky-720.webp 720w" };
const SPOT = { x: 56, y: 37 }; // the kite, % of the (square) photo
const THEIRS = { x: 61, y: 32 };

const pop = (delay = 0) => ({
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { ...spring.bouncy, delay },
});

/** A player pill on the photo: avatar + name + city. */
function PlayerPill({ name, place, avatar, tone }: { name: string; place: string; avatar: string; tone: "you" | "them" }) {
  return (
    <span className={cn("pop flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5", tone === "you" ? "bg-lime" : "bg-bubble")}>
      <Avatar handle={name} avatar={avatar} size={44} />
      <span className="flex flex-col leading-tight">
        <span className="font-display text-[17px] font-black text-ink">{name}</span>
        <span className="text-[14px] font-semibold text-ink/75">{place}</span>
      </span>
    </span>
  );
}

/**
 * The photo with a camera. It fills the whole stage; because the photo is square, it's drawn as a square
 * sized by the stage's height and centred, so overlays inside use the photo's own % coordinates and stay on
 * the kite whatever the screen shape. `isolate` keeps its layers (photo, dim) under the overlays above it.
 */
function Camera({ scene, still, children }: { scene: number; still: boolean | null; children?: ReactNode }) {
  // 1: settle wide (both players on the same photo), hold, then push in on the kite. 2: pull back, dim.
  const shots: { animate: TargetAndTransition; transition: Transition }[] = [
    {
      animate: { scale: [1.18, 1, 1, 1.45], x: ["0%", "0%", "0%", "-9%"], y: ["0%", "0%", "0%", "19%"] },
      transition: { duration: PUSH_AT + 1.4, times: [0, 0.3, PUSH_AT / (PUSH_AT + 1.4), 1], ease: [0.22, 1, 0.36, 1] },
    },
    { animate: { scale: 1.08, x: "0%", y: "0%" }, transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } },
  ];
  const shot = shots[Math.min(scene, 1)]!;
  return (
    <div className="pop absolute inset-0 isolate z-0 overflow-hidden rounded-[28px] bg-sky">
      <div className="absolute inset-y-0 left-1/2 aspect-square h-full -translate-x-1/2">
        <m.div
          className="absolute inset-0 origin-center"
          initial={still ? false : { scale: 1.18 }}
          animate={still ? undefined : shot.animate}
          transition={shot.transition}
        >
          {/* The largest thing on a first visit (the LCP): fetch it first. */}
          <img
            src={HERO.src}
            srcSet={HERO.srcSet}
            sizes="(min-width: 640px) 720px, 180vw"
            alt=""
            width={720}
            height={720}
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover"
          />
          {children}
        </m.div>
      </div>
      {/* Scene 2 dims the picture so the words take the stage. */}
      <m.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-night"
        initial={{ opacity: 0 }}
        animate={{ opacity: scene === 1 ? 0.55 : 0 }}
        transition={{ duration: 0.6 }}
      />
    </div>
  );
}

/** 1a · Two strangers, one picture: their pills glide onto the top corners, then step aside for the tap. */
function Strangers() {
  return (
    <m.div
      className="absolute inset-0"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.4, delay: PUSH_AT + 0.2 }}
    >
      <m.span className="absolute top-4 left-3 z-10" initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...spring.soft, delay: 0.35 }}>
        <PlayerPill name={t("play.you")} place="Mysuru" avatar="a1" tone="you" />
      </m.span>
      <m.span className="absolute top-4 right-3 z-10" initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...spring.soft, delay: 0.6 }}>
        <PlayerPill name="meera_k" place="Kochi" avatar="a3" tone="them" />
      </m.span>
    </m.div>
  );
}

/** 1b · The tap, once the camera is in: a finger glides in, taps, both markers drop (yours lime, hers
 *  bubblegum, like the pills), a shared glow breathes. Moves with the camera. */
function Tap() {
  const at = PUSH_AT + 0.6; // every beat below starts after the push-in
  return (
    <>
      <m.span
        aria-hidden
        className="absolute z-20 text-white drop-shadow-sticker"
        initial={{ left: "45%", top: "105%", opacity: 0 }}
        animate={{ left: `${SPOT.x - 3}%`, top: `${SPOT.y + 1}%`, opacity: [0, 1, 1, 0], scale: [1, 1, 0.82, 1] }}
        transition={{ duration: 1.3, times: [0, 0.25, 0.75, 1], delay: at + 1.1, ease: "easeInOut" }}
      >
        <Hand className="size-7" strokeWidth={2.25} />
      </m.span>
      <m.span
        aria-hidden
        className="absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white"
        style={{ left: `${SPOT.x}%`, top: `${SPOT.y}%` }}
        initial={{ scale: 0.2, opacity: 0 }}
        // First keyframe invisible: Motion holds it during the delay, so the ring must not show before the tap.
        animate={{ scale: [0.2, 0.2, 2], opacity: [0, 1, 0] }}
        transition={{ duration: 0.6, times: [0, 0.01, 1], delay: at + 2 }}
      />
      <m.span
        aria-hidden
        className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-lime bg-lime/25"
        style={{ left: `${(SPOT.x + THEIRS.x) / 2}%`, top: `${(SPOT.y + THEIRS.y) / 2}%` }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 1, 1.1, 1], opacity: 1 }}
        transition={{ duration: 1.2, delay: at + 2.6 }}
      />
      <m.span aria-hidden className="pop-sm absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime" style={{ left: `${SPOT.x}%`, top: `${SPOT.y}%` }} {...pop(at + 2.05)} />
      <m.span aria-hidden className="pop-sm absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bubble" style={{ left: `${THEIRS.x}%`, top: `${THEIRS.y}%` }} {...pop(at + 2.45)} />
    </>
  );
}

/** 2 · Words sweep in over the dimmed photo, meet, vanish into the Bhasha sticker. */
function Words() {
  const still = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <m.span
        className="absolute"
        initial={{ x: -170, y: 120, rotate: -14, opacity: 0, scale: 1 }}
        animate={{ x: [-170, -58, -58, -10], y: [120, 0, 0, 0], rotate: [-14, -6, -6, 0], opacity: [0, 1, 1, 0], scale: [1, 1, 1, 0.4] }}
        transition={{ duration: 1.9, times: [0, 0.4, 0.75, 1], delay: 0.2, ease: "easeOut" }}
      >
        <WordBubble word="kite" lang="en" size="lg" state="idle" />
      </m.span>
      <m.span
        className="absolute"
        initial={{ x: 170, y: 120, rotate: 14, opacity: 0, scale: 1 }}
        animate={{ x: [170, 58, 58, 10], y: [120, 0, 0, 0], rotate: [14, 6, 6, 0], opacity: [0, 1, 1, 0], scale: [1, 1, 1, 0.4] }}
        transition={{ duration: 1.7, times: [0, 0.4, 0.75, 1], delay: 0.4, ease: "easeOut" }}
      >
        <WordBubble word="पतंग" lang="hi" size="lg" state="partner" side="right" />
      </m.span>
      <m.span
        aria-hidden
        className="absolute size-48 rounded-full bg-lime"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5], opacity: [0.85, 0] }}
        transition={{ duration: 0.55, delay: 1.45 }}
      />
      <After ms={1550}>
        <div className="relative grid place-items-center">
          {!still ? <Confetti pieces={20} /> : null}
          <PinchStamp variant="bhasha" label={t("play.reveal.bhasha")} className="min-h-[130px] min-w-[260px]" />
        </div>
      </After>
    </div>
  );
}

/** Mounts children after a delay — for beats that must wait for the previous one to land. */
function After({ ms, children }: { ms: number; children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return on ? children : null;
}

// Two beats: the core loop (who you play with + what you do), then the twist (any language counts).
const CAPTIONS: { title: Key; sub: Key }[] = [
  { title: "story.1.title", sub: "story.1.sub" },
  { title: "story.3.title", sub: "story.3.sub" },
];

export function Story({ onStart }: { onStart: () => void }) {
  const still = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0); // bump to replay
  const total = CAPTIONS.length;
  const done = i >= total;
  const auto = !still && !paused && !done;

  // Auto-advance (never with reduced motion); hold while the tab is hidden.
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => {
      if (document.visibilityState === "visible") setI((x) => x + 1);
    }, SCENE_MS[i] ?? SCENE_MS[0]);
    return () => clearTimeout(id);
  }, [auto, i, run]);

  const go = (d: number) => setI((x) => Math.min(total, Math.max(0, x + d)));
  const cap = CAPTIONS[Math.min(i, total - 1)]!;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {done ? (
        <m.div className="flex flex-1 flex-col items-center justify-center gap-4 text-center" {...pop(0)}>
          <Logo size={120} />
          <h1 className="max-w-[16ch] text-[32px] leading-[1.02] font-black text-balance text-ink md:text-[40px]">{t("practice.intro_title")}</h1>
          <p className="max-w-[30ch] text-[16px] text-ink-muted">{t("practice.intro_meta")}</p>
        </m.div>
      ) : (
        // The stage: the photo takes all the height there is (at least 60 % of the screen); caption on it.
        <div className="relative mx-auto min-h-[60dvh] w-full max-w-[560px] flex-1 short:min-h-[52dvh]">
          <Camera key={`cam-${run}`} scene={i} still={still}>
            <AnimatePresence>
              {i === 0 ? (
                <m.div key={`tap-${run}`} className="absolute inset-0" exit={{ opacity: 0 }}>
                  <Tap />
                </m.div>
              ) : null}
            </AnimatePresence>
          </Camera>
          {/* Overlays that don't move with the camera. */}
          <AnimatePresence>
            {i === 0 ? (
              <m.div key={`s1-${run}`} className="pointer-events-none absolute inset-0 z-20" exit={{ opacity: 0 }}>
                <Strangers />
              </m.div>
            ) : null}
            {i === 1 ? (
              <m.div key={`s2-${run}`} className="pointer-events-none absolute inset-x-0 top-0 bottom-[28%] z-20" exit={{ opacity: 0 }}>
                <Words />
              </m.div>
            ) : null}
          </AnimatePresence>
          {i === 0 ? (
            <m.span
              key={`chip-${run}`}
              className="pop absolute top-4 right-4 z-20 rotate-6 rounded-full bg-lime px-4 py-1.5 font-display text-[19px] font-black text-ink"
              {...pop(PUSH_AT + 3.5)}
            >
              {t("story.same_spot")}
            </m.span>
          ) : null}

          {/* Caption, on the photo. */}
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-[22px] bg-night/80 px-4 py-3.5 text-center text-white">
            <AnimatePresence mode="wait">
              <m.div
                key={`cap-${i}-${run}`}
                className="flex flex-col gap-1"
                aria-live="polite"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="text-[24px] leading-[1.05] font-black text-balance md:text-[30px]">{t(cap.title)}</h2>
                <p className="mx-auto max-w-[32ch] text-[15px] text-white/80">{t(cap.sub)}</p>
              </m.div>
            </AnimatePresence>
          </div>

          {/* Tap zones: left = back, right = next (stories convention). */}
          <button type="button" aria-label={t("common.back")} onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-30 w-1/3 cursor-pointer" />
          <button type="button" aria-label={t("common.next")} onClick={() => go(1)} className="absolute inset-y-0 right-0 z-30 w-2/3 cursor-pointer" />
        </div>
      )}

      {/* Progress: small, bottom-centre. The current scene is a short pill that fills as it plays. */}
      {!done ? (
        <div className="flex items-center justify-center gap-1.5" aria-hidden>
          {CAPTIONS.map((_, j) =>
            j === i ? (
              <span key={j} className="h-1.5 w-7 overflow-hidden rounded-full bg-ink/15">
                <m.span
                  key={`${i}-${run}-${paused}`}
                  className="block h-full rounded-full bg-ink"
                  initial={{ width: still ? "100%" : "0%" }}
                  animate={{ width: auto || still ? "100%" : "0%" }}
                  transition={{ duration: auto ? (SCENE_MS[i] ?? SCENE_MS[0]!) / 1000 : 0, ease: "linear" }}
                />
              </span>
            ) : (
              <span key={j} className={cn("size-1.5 rounded-full", j < i ? "bg-ink" : "bg-ink/20")} />
            ),
          )}
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-2">
        <Button variant="play" size="xl" block onClick={onStart} className="max-w-[380px]">
          {t("practice.intro_cta")}
        </Button>
        <div className="flex items-center gap-4 text-[14px] font-semibold text-ink-muted">
          {done ? (
            <button
              type="button"
              onClick={() => {
                setI(0);
                setRun((r) => r + 1);
              }}
              className="flex cursor-pointer items-center gap-1.5 hover:text-ink"
            >
              <RotateCcw className="size-4" aria-hidden />
              {t("story.replay")}
            </button>
          ) : (
            <>
              {still ? (
                <button type="button" onClick={() => go(1)} className="cursor-pointer hover:text-ink">
                  {t("common.next")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="flex cursor-pointer items-center gap-1.5 hover:text-ink"
                  aria-pressed={paused}
                >
                  {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                  {paused ? t("story.resume") : t("story.pause")}
                </button>
              )}
              <button type="button" onClick={() => setI(total)} className="cursor-pointer hover:text-ink">
                {t("onboarding.skip")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
