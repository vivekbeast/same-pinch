// /play/:packId — 5 photo rounds (D40): Pinch → Name it → Flip (docs/SCREENS.md §5, docs/ARCHITECTURE.md §5).
// Phone: vertical stack, input held above the keyboard. Tablet: media | controls. Desktop: centre
// stage with You | Partner cards + a pack-progress rail, fully keyboard-driven.
import { useMutation, useQuery } from "@tanstack/react-query";
import { m } from "motion/react";
import { Flame, Lock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api as contract, HOT_HAND, PINCH_KINDS, type z } from "@shared";
import { Panel } from "@/components/cards";
import { InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/events";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";
import { rupees } from "@/lib/format";
import { currentLang, t, tk } from "@/lib/i18n";
import { useMe } from "@/lib/session";
import { useFamily } from "@/lib/use-family";
import { PromptMedia } from "@/components/prompt-media";
import { fromGrid, PinchBoard, toGrid, type Point } from "@/components/game/PinchBoard";
import { usePrefs } from "@/lib/prefs";
import { NoteChips } from "@/components/game/NoteChips";
import { Reveal } from "@/components/game/Reveal";
import { loadRoundResults, saveRoundResult, type StoredRound } from "@/lib/round-store";
import { TimerRing } from "./TimerRing";
import { withMotion } from "@/components/motion-root";
import { WordInput, type Word } from "@/components/game/WordInput";

type Pack = z.infer<typeof contract.Pack>;
type Result = z.infer<typeof contract.RoundResultResponse>;
type Phase = "prompting" | "checking" | "revealing" | "sealed";

const isPinch = (r?: Result) => r?.result === "exact" || r?.result === "bhasha";

/** Hot hand: the last HOT_HAND.after rounds in this pack were pinches (the server re-checks). */
const isHot = (results: (StoredRound | undefined)[], index: number) =>
  index >= HOT_HAND.after && results.slice(index - HOT_HAND.after, index).every((r) => isPinch(r?.result));

function ProgressDots({ results, index, total }: { results: (StoredRound | undefined)[]; index: number; total: number }) {
  return (
    <ol
      className="flex h-4 flex-1 items-center gap-0.5 overflow-hidden rounded-full bg-surface p-0.5 pop-sm"
      aria-label={t("play.round", { n: index + 1 })}
    >
      {Array.from({ length: total }, (_, i) => {
        const r = results[i]?.result;
        return (
          <li
            key={i}
            className={cn(
              "h-full flex-1 rounded-full",
              isPinch(r)
                ? "bg-success-bright"
                : r
                  ? "bg-ink-faint/60"
                  : i === index
                    ? "bg-marigold"
                    : "bg-surface-2",
            )}
          />
        );
      })}
    </ol>
  );
}

/** Keeps the input bar above the on-screen keyboard (docs/RESPONSIVE.md §4 Play). */
function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--kb",
        `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`,
      );
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--kb");
    };
  }, []);
}

function Play() {
  const { packId = "" } = useParams();
  const me = useMe();
  useKeyboardInset();
  // Network first (fresh "answered"), stored copy when offline (docs/ARCHITECTURE.md §4).
  const pack = useQuery({
    queryKey: ["pack", packId],
    staleTime: Infinity,
    queryFn: async () => {
      const offline = await import("@/lib/offline");
      try {
        const fresh = await api(`/packs/${packId}`, { schema: "Pack" });
        await offline.storePack(fresh);
        return fresh;
      } catch (e) {
        const stored = await offline.getStoredPack(packId);
        if (stored && e instanceof ApiError && e.code === "NETWORK") return stored;
        throw e;
      }
    },
  });
  const queued = useQuery({
    queryKey: ["queue", packId],
    queryFn: async () => (await import("@/lib/offline")).queuedFor(packId),
    staleTime: 0,
  });

  if (pack.isPending || queued.isPending || !me.data) {
    return (
      <main
        className="mx-auto flex min-h-dvh max-w-[1200px] flex-col gap-5 bg-canvas p-5 md:p-8"
        aria-busy="true"
      >
        <Skeleton className="h-10" />
        <Skeleton className="aspect-square max-h-[52dvh] md:aspect-[4/3]" />
        <Skeleton className="h-14 rounded-full" />
      </main>
    );
  }
  if (pack.error) {
    return (
      <main className="mx-auto max-w-[560px] p-5">
        <InlineError error={pack.error} onRetry={() => pack.refetch()} />
      </main>
    );
  }
  return (
    <Runner
      pack={pack.data}
      queuedPrompts={queued.data?.map((q) => q.promptId) ?? []}
      handle={me.data.handle}
    />
  );
}

/** Pack-level state: which round, results so far. Resumes where the server says we are. */
function Runner({ pack, queuedPrompts, handle }: { pack: Pack; queuedPrompts: string[]; handle: string }) {
  const packId = pack.packId;
  const [results, setResults] = useState<(StoredRound | undefined)[]>(() => loadRoundResults(packId));
  const [index, setIndex] = useState(() => {
    const done = new Set([
      ...pack.answered,
      ...queuedPrompts,
      ...results.filter(Boolean).map((r) => r!.promptId),
    ]);
    return pack.rounds.findIndex((r) => !done.has(r.promptId));
  });
  if (index === -1) return <Navigate to={`/play/${packId}/done`} replace />;
  return (
    <RoundView
      key={index}
      pack={pack}
      index={index}
      results={results}
      handle={handle}
      onResult={(stored) => {
        saveRoundResult(packId, index, stored);
        setResults((rs) => {
          const next = [...rs];
          next[index] = stored;
          return next;
        });
      }}
      onNext={() => setIndex((i) => i + 1)}
    />
  );
}

/** One round. Keyed by index, so every round starts with fresh state (no effect-driven resets). */
function RoundView({
  pack,
  index,
  results,
  handle,
  onResult,
  onNext,
}: {
  pack: Pack;
  index: number;
  results: (StoredRound | undefined)[];
  handle: string;
  onResult: (r: StoredRound) => void;
  onNext: () => void;
}) {
  const packId = pack.packId;
  const navigate = useNavigate();
  const family = useFamily();
  const round = pack.rounds[index]!;
  // Hot hand: half the time for double XP. Decided once per round (RoundView is keyed by index).
  const [hot] = useState(() => isHot(results, index));
  const seconds = hot ? Math.ceil(round.seconds * HOT_HAND.timeShare) : round.seconds;
  const [phase, setPhase] = useState<Phase>("prompting");
  const [words, setWords] = useState<Word[]>([]);
  const [current, setCurrent] = useState<Result | null>(null);
  const [left, setLeft] = useState(seconds);
  const [leaving, setLeaving] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const flushRef = useRef<(() => Word[]) | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null); // this round's answer id (Pinch Notes)
  const nextRef = useRef<HTMLButtonElement>(null);
  // Pinch the Picture (D39): photo rounds are played by pinching a spot; naming it is optional.
  const pinchRound = PINCH_KINDS.includes(round.kind) && !!round.asset;
  const [pinch, setPinch] = useState<Point | null>(null);
  const saver = usePrefs((p) => p.dataSaver);

  // Word rounds start in the input. Photo rounds start on the photo — a keyboard would cover it.
  useEffect(() => {
    if (!pinchRound) inputRef.current?.focus({ preventScroll: true });
  }, [pinchRound]);

  // Every answer is written to the IndexedDB queue BEFORE it's sent, so it survives a dead network or a
  // closed tab. Offline → the round seals and play goes on; the queue flushes when the connection returns.
  const submit = useMutation({
    mutationFn: async ({
      words: submitted,
      pinch: at,
      attemptId: id,
    }: {
      words: Word[];
      pinch: Point | null;
      attemptId: string;
    }): Promise<Result | "sealed"> => {
      const offline = await import("@/lib/offline");
      const body = {
        attemptId: id,
        packId,
        promptId: round.promptId,
        words: submitted.filter((w) => !w.burnt).map(({ text, lang }) => ({ text, lang })),
        pinch: pinchRound && at ? toGrid(at) : null,
        playedAt: new Date().toISOString(),
        responseMs: Date.now() - startedAt,
      };
      await offline.enqueue({
        attemptId: body.attemptId,
        packId,
        promptId: round.promptId,
        index,
        kind: round.kind,
        textKey: round.textKey,
        body,
        createdAt: Date.now(),
      });
      try {
        const res = await api("/rounds", { method: "POST", schema: "RoundResultResponse", body });
        await offline.dequeue(body.attemptId);
        return res;
      } catch (e) {
        if (e instanceof ApiError && (e.code === "NETWORK" || e.status >= 500)) return "sealed";
        await offline.dequeue(body.attemptId);
        throw e;
      }
    },
    onSuccess: (res) => {
      track("round_drop", { kind: round.kind, offline: res === "sealed" });
      if (res === "sealed") {
        setPhase("sealed");
        return;
      }
      setCurrent(res);
      setPhase("revealing");
      onResult({ promptId: round.promptId, kind: round.kind, textKey: round.textKey, result: res });
    },
    onError: async (e) => {
      // Edges (D44): the pack moved on without this phone — collected elsewhere, or trimmed (D44 migration).
      if (e instanceof ApiError && (e.code === "STALE_ROUND" || e.code === "NOT_FOUND")) {
        toast(t("play.pack_gone"));
        await (await import("@/lib/offline")).forgetPack(packId);
        navigate("/", { replace: true });
        return;
      }
      // Answered from another tab/device: that round is done — move on.
      if (e instanceof ApiError && e.code === "ALREADY_ANSWERED") {
        toast(t("play.already_answered"));
        if (last) navigate(`/play/${packId}/done`);
        else onNext();
        return;
      }
      setPhase("prompting");
    },
  });

  const drop = useCallback(
    (final: Word[] = words) => {
      if (phase !== "prompting") return;
      setPhase("checking");
      const id = crypto.randomUUID();
      setAttemptId(id);
      submit.mutate({ words: final, pinch, attemptId: id });
    },
    [phase, submit, words, pinch],
  );

  // Timer ticks from its own callback; at 0 it drops what we have (empty = skipped, no penalty).
  useEffect(() => {
    if (phase !== "prompting") return;
    const id = setTimeout(() => {
      if (left <= 1) drop();
      else setLeft(left - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [left, phase, drop]);

  // Focus Next once the reveal lands (keyboard flow), without autoFocus.
  useEffect(() => {
    if (phase === "revealing" || phase === "sealed") nextRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const last = index === pack.rounds.length - 1;
  const next = useCallback(() => {
    if (phase !== "revealing" && phase !== "sealed") return;
    if (last) navigate(`/play/${packId}/done`);
    else onNext();
  }, [phase, last, navigate, packId, onNext]);

  // Space / → for next during the reveal (Enter is handled by the focused Next button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (phase === "revealing" || phase === "sealed") &&
        (e.key === " " || e.key === "ArrowRight") &&
        document.activeElement?.tagName !== "BUTTON"
      ) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next]);

  const earned = useMemo(() => results.reduce((a, r) => a + (r?.result.earnPaise ?? 0), 0), [results]);
  const prompt = tk(round.textKey, round.textParams ?? undefined);
  const crowd = current?.spot?.crowd ?? null;
  const crowdLabel = crowd ? (crowd.near ? t("play.crowd_near", { pct: crowd.near }) : t("play.crowd_alone")) : undefined;
  const announce =
    phase === "revealing" && current
      ? `${current.spot?.same ? `${t("play.same_spot")} ` : ""}${t(`play.reveal.${current.result}`)} ${current.you.map((w) => w.text).join(", ")}. ${current.partner?.words.map((w) => w.text).join(", ") ?? ""}${crowdLabel ? `. ${crowdLabel}` : ""}`
      : "";
  const title = pinchRound ? t("play.pinch_title") : prompt;

  const topBar = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label={t("play.leave")}
        className="grid size-11 shrink-0 press cursor-pointer place-items-center rounded-full bg-surface text-ink pop-sm"
      >
        <X className="size-5" strokeWidth={3} />
      </button>
      <ProgressDots results={results} index={index} total={pack.rounds.length} />
      {hot && phase === "prompting" ? (
        <span
          role="status"
          aria-label={t("play.hot")}
          className="flex shrink-0 items-center gap-1 rounded-full bg-pinch px-2.5 py-0.5 text-[15px] font-black text-white pop-sm"
        >
          <Flame className="size-4" strokeWidth={3} aria-hidden />
          <span aria-hidden>{t("play.hot_chip")}</span>
        </span>
      ) : null}
      <span className="shrink-0 text-[18px] font-black text-ink tabular-nums">{index + 1}/{pack.rounds.length}</span>
      <span className="shrink-0 rounded-full bg-marigold px-3 py-0.5 text-[17px] font-black text-ink tabular-nums pop-sm">
        {rupees(earned)}
      </span>
    </div>
  );

  const hintId = `pinch-hint-${index}`;
  const pinchHint =
    pinchRound && phase === "prompting" ? (
      <p id={hintId} className="text-[15px] font-bold text-ink-muted">
        {t("play.pinch_hint")}
      </p>
    ) : null;
  const burntList = round.burnt.length ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[14px] font-extrabold text-ink-muted">{t("play.burnt")}</span>
      {round.burnt.map((b) => (
        <span
          key={b}
          className="rounded-full border-2 border-dashed border-ink-faint px-3 py-0.5 text-[15px] font-bold text-ink-muted line-through"
        >
          {b}
        </span>
      ))}
    </div>
  ) : null;
  const burntRow =
    pinchHint || burntList ? (
      <>
        {pinchHint}
        {burntList}
      </>
    ) : null;

  // One-tap play (D44): a tap on the photo is the answer — with any word typed so far, Enter or not.
  const tapPinch = (p: Point) => {
    if (phase !== "prompting") return;
    const final = flushRef.current?.() ?? words;
    setPinch(p);
    setPhase("checking");
    const id = crypto.randomUUID();
    setAttemptId(id);
    submit.mutate({ words: final, pinch: p, attemptId: id });
  };

  const controls =
    phase === "revealing" || phase === "sealed" ? (
      <Button ref={nextRef} variant="play" block onClick={next}>
        {last ? t("play.see_results") : t("play.next")}
      </Button>
    ) : (
      <div className="flex flex-col gap-4">
        <WordInput
          ref={inputRef}
          words={words}
          onChange={setWords}
          onDrop={drop}
          burnt={round.burnt}
          defaultLang="en"
          disabled={phase === "checking"}
          placeholder={pinchRound ? t("play.name_it") : t("play.placeholder")}
          lang={currentLang()}
          flushRef={flushRef}
        />
        {submit.error ? <InlineError error={submit.error} onRetry={() => drop()} /> : null}
        <div className="flex items-center gap-3">
          <TimerRing left={left} total={seconds} />
          {pinchRound ? (
            // No Lock button on photo rounds: tapping the photo answers. Only the time is left to show.
            <p className="flex-1 text-[15px] font-semibold text-ink-muted" aria-live="polite">
              {phase === "checking" ? t("play.dropping") : t("play.tap_to_answer")}
            </p>
          ) : (
            <Button
              onClick={() => drop()}
              disabled={!words.some((w) => !w.burnt)}
              busy={phase === "checking"}
              className="flex-1"
            >
              {phase === "checking" ? t("play.dropping") : t("play.drop")}
            </Button>
          )}
        </div>
        {family === "desktop" && !pinchRound ? <p className="text-[15px] text-ink-muted">{t("play.shortcuts")}</p> : null}
      </div>
    );

  const stage =
    phase === "sealed" ? (
      <div className="flex items-center gap-4 rounded-tile bg-night p-5 text-white pop" role="status">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/10">
          <Lock className="size-6 text-white/70" strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-black">{t("play.sealed_title")}</p>
          <p className="text-white/70">{t("play.sealed_sub")}</p>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        <Reveal
          result={phase === "revealing" ? current : null}
          myWords={words.filter((w) => !w.burnt).map(({ text, lang }) => ({ text, lang }))}
          revealed={phase === "revealing"}
          myName={handle}
        />
        {/* Pinch Notes (D48): one preset note to the person you just played with. */}
        {phase === "revealing" && current?.partner ? (
          <NoteChips attemptId={attemptId} partner={current.partner} />
        ) : null}
      </div>
    );

  const media = pinchRound ? (
    <PinchBoard
      src={saver ? round.asset!.src.replace("-480.", "-320.") : round.asset!.src}
      srcSet={saver ? undefined : round.asset!.srcset}
      sizes="(min-width: 1280px) 720px, (min-width: 768px) 56vw, 100vw"
      mine={pinch}
      partner={current?.spot?.partner ? fromGrid(current.spot.partner) : null}
      revealed={phase === "revealing"}
      same={current?.spot?.same ?? false}
      crowd={phase === "revealing" ? crowd : null}
      crowdLabel={crowdLabel}
      interactive={phase === "prompting"}
      onPlace={setPinch}
      onTap={tapPinch}
      onLock={() => pinch && tapPinch(pinch)}
      youLabel={t("play.you")}
      partnerLabel={current?.partner?.handle}
      label={t("play.pinch_label")}
      describedBy={hintId}
      // Phone: the board fills its box (see the phone layout); elsewhere it's a square card.
      fill={family === "phone"}
    />
  ) : (
    <PromptMedia
      round={round}
      onSkip={() => {
        setWords([]);
        drop();
      }}
      className={cn(
        round.kind === "question"
          ? "aspect-[4/3] w-full xl:aspect-square"
          : "aspect-square w-full md:aspect-[4/3] xl:aspect-square",
        // Phone reveal: the prompt stays on screen as a short banner above the cards.
        family === "phone" &&
          (phase === "revealing" || phase === "sealed") &&
          "aspect-[5/2] short:aspect-[4/1] [&_p]:text-[26px]",
      )}
    />
  );

  return (
    <main className="min-h-dvh">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {family === "phone" && pinchRound ? (
        // Pinch rounds (D48): the photo fills the screen until you tap; then it shrinks and the answer panel
        // slides up from the bottom with the reveal, your partner's words, notes and Next. The shrink is
        // instant on purpose: animating height re-lays out the page every frame (AGENTS.md: transform and
        // opacity only); the panel's slide-up carries the motion.
        <div
          className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-2.5 px-3 pt-[calc(12px+env(safe-area-inset-top))] sm:px-5"
          style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom) + var(--kb, 0px))" }}
        >
          {topBar}
          <h1 className="sr-only">{title}</h1>
          <div
            className={cn(
              "relative shrink-0",
              phase === "prompting"
                ? "h-[calc(100dvh-210px-var(--kb,0px))] min-h-[300px]"
                : "h-[34dvh] min-h-[200px] short:h-[28dvh]",
            )}
          >
            {media}
            {/* The instruction lives on the photo, not above it. */}
            {phase === "prompting" ? (
              <p
                id={hintId}
                className="pointer-events-none absolute top-3 left-3 z-20 max-w-[85%] rounded-full bg-night/80 px-3.5 py-1.5 text-[14px] font-semibold text-white"
              >
                {t("play.pinch_hint_short")}
              </p>
            ) : null}
          </div>
          {phase === "prompting" ? (
            <div className="flex flex-col gap-2">
              {burntList}
              {controls}
            </div>
          ) : (
            <m.section
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={spring.soft}
              className="pop flex flex-1 flex-col gap-4 rounded-[28px] bg-surface p-4"
              aria-live="polite"
            >
              {phase === "checking" ? (
                <p className="flex flex-1 items-center justify-center gap-2 py-6 text-[16px] font-semibold text-ink-muted">
                  <Spinner className="size-5" />
                  {t("play.dropping")}
                </p>
              ) : (
                <>
                  {stage}
                  <div className="mt-auto">{controls}</div>
                </>
              )}
            </m.section>
          )}
        </div>
      ) : family === "phone" ? (
        // One centred stack — title, picture, words, action — instead of content glued to the top and
        // the bottom with a dead gap between. The keyboard inset lifts the whole stack.
        <div
          className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-3 pt-[calc(14px+env(safe-area-inset-top))] sm:px-5"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom) + var(--kb, 0px))" }}
        >
          {topBar}
          <div className="flex flex-1 flex-col justify-center gap-4 py-2 short:gap-3">
            {round.kind !== "question" ? (
              <div className="flex flex-col gap-1">
                <h1 className="text-[24px] leading-tight font-black text-ink">{title}</h1>
                {burntRow}
              </div>
            ) : (
              <h1 className="sr-only">{prompt}</h1>
            )}
            {/* The photo is the game: as wide as the screen allows (short phones keep room for the action). */}
            <div className="mx-auto w-full short:max-w-[300px]">{media}</div>
            {round.kind === "question" ? burntRow : null}
            {phase === "revealing" || phase === "sealed" ? stage : null}
            {controls}
          </div>
        </div>
      ) : family === "tablet" ? (
        <div className="mx-auto flex min-h-dvh max-w-[1180px] flex-col gap-6 px-8 py-8 lg:px-10">
          {topBar}
          <div className="grid flex-1 grid-cols-[56%_1fr] gap-8">
            <div className="flex flex-col gap-4">{media}</div>
            <div className="flex flex-col gap-5">
              {round.kind !== "question" ? (
                <h1 className="text-[32px] leading-tight font-black text-ink">{title}</h1>
              ) : (
                <h1 className="sr-only">{prompt}</h1>
              )}
              {burntRow}
              {phase === "revealing" || phase === "sealed" ? stage : null}
              <div className="mt-auto">{controls}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid min-h-dvh max-w-[1440px] grid-cols-[1fr_300px] gap-8 px-10 py-8">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5">
            {topBar}
            {/* Desktop: the photo is the big left column (sized to the screen height); title, words and the
                timer sit beside it — everything visible without scrolling. Cards appear only after answering. */}
            <div className="grid grid-cols-[minmax(0,min(720px,calc(100dvh-170px)))_minmax(300px,1fr)] items-start gap-8">
              {media}
              <div className="flex flex-col gap-5 pt-2">
                {round.kind !== "question" ? (
                  <h1 className="text-[36px] leading-[1.05] font-black text-ink">{title}</h1>
                ) : (
                  <h1 className="sr-only">{prompt}</h1>
                )}
                {burntRow}
                {phase === "revealing" || phase === "sealed" ? stage : null}
                {controls}
              </div>
            </div>
          </div>
          <aside className="flex flex-col gap-4">
            <Panel className="flex flex-col gap-3 p-5">
              <h2 className="text-2xl font-bold">{t("play.progress")}</h2>
              <ol className="flex flex-col">
                {pack.rounds.map((r, i) => {
                  const res = results[i]?.result;
                  return (
                    <li
                      key={r.promptId}
                      className={cn(
                        "flex items-center gap-3 border-b border-line py-2 last:border-0",
                        i === index && "font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "size-3 shrink-0 rounded-full",
                          isPinch(res)
                            ? "bg-success-bright"
                            : res
                              ? "bg-ink-faint/50"
                              : i === index
                                ? "bg-ink"
                                : "bg-line",
                        )}
                      />
                      {r.asset ? (
                        <img
                          src={r.asset.src.replace("-480.", "-320.")}
                          alt=""
                          loading="lazy"
                          className="size-9 shrink-0 rounded-[8px] object-cover"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[15px] text-ink-2">{tk(r.textKey)}</span>
                      {res && res.earnPaise > 0 ? (
                        <span className="text-sm font-semibold text-marigold-ink">
                          {rupees(res.earnPaise)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </aside>
        </div>
      )}

      <Sheet
        open={leaving}
        onOpenChange={setLeaving}
        title={t("play.leave_title")}
        description={t("play.leave_sub")}
      >
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button onClick={() => setLeaving(false)}>{t("play.stay")}</Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            {t("play.leave")}
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

export default withMotion(Play);
