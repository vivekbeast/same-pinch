// First run = the game itself (docs/UI_DIRECTION.md v3; docs/DECISIONS.md D39): the signature mechanic,
// **Pinch the Picture**, played against scripted partners and coached by Chutki. Runs entirely on the
// phone — no account, no network, no money. One round is the whole loop:
//   Notice (pinch a spot) → Discover (their pinch appears; a shared glow if it's the same spot)
//   → Connect (their words, in their language) → Contribute (Smart Chips or your own word) → next round.
// Round 2's partner speaks Hindi, so "same meaning, different language" is felt before it's explained.
import { m, useReducedMotion } from "motion/react";
import { Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { detectLang, normalize, type api, type Lang, type z } from "@shared";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/plates";
import { PinchBoard, type Point } from "@/components/game/PinchBoard";
import { Story } from "./Story";
import { NoteChips } from "@/components/game/NoteChips";
import { Confetti } from "@/components/stamp";
import { Button } from "@/components/ui/button";
import { WordBubble } from "@/components/words";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { t, type Key } from "@/lib/i18n";
import { spring } from "@/lib/motion";

type AvatarId = z.infer<typeof api.Avatar>;

/** A word with a meaning id, so "nose" and "नाक" are recognised as the same thought. */
interface ChipWord {
  text: string;
  lang: Lang;
  meaning: string;
}
/** A labelled area of the photo: what Smart Chips suggest when you pinch near it. */
interface Spot extends Point {
  r: number;
  words: ChipWord[];
}
interface PracticeRound {
  photo: string;
  coach: Key;
  partner: { handle: string; avatar: AvatarId; place: string; pinch: Point; words: ChipWord[] };
  spots: Spot[];
  /** Chips when your pinch isn't near any labelled spot. */
  general: ChipWord[];
}

/** Two pinches count as "the same spot" within this distance (fraction of the photo's side). */
const SAME_SPOT = 0.17;

const w = (meaning: string, ...pairs: [string, Lang][]): ChipWord[] =>
  pairs.map(([text, lang]) => ({ text, lang, meaning }));

const ROUNDS: PracticeRound[] = [
  {
    // One lit diya: a clean, single-subject photo (owner: "less messy images" in the welcome).
    photo: "diyas-row",
    coach: "practice.coach_1",
    partner: {
      handle: "meera_k",
      avatar: "a3",
      place: "Kochi",
      pinch: { x: 0.52, y: 0.49 },
      words: [...w("lamp", ["diya", "en"]), ...w("diwali", ["diwali", "en"])],
    },
    spots: [
      { x: 0.51, y: 0.5, r: 0.13, words: [...w("lamp", ["diya", "en"], ["दीया", "hi"], ["ದೀಪ", "kn"], ["விளக்கு", "ta"]), ...w("flame", ["flame", "en"])] },
      { x: 0.37, y: 0.33, r: 0.12, words: w("flower", ["flower", "en"], ["फूल", "hi"], ["ಹೂವು", "kn"], ["பூ", "ta"]) },
      { x: 0.13, y: 0.18, r: 0.12, words: w("fruit", ["apple", "en"], ["सेब", "hi"], ["ಸೇಬು", "kn"], ["ஆப்பிள்", "ta"]) },
    ],
    general: [...w("diwali", ["diwali", "en"], ["दिवाली", "hi"], ["ದೀಪಾವಳಿ", "kn"], ["தீபாவளி", "ta"]), ...w("light", ["light", "en"])],
  },
  {
    photo: "street-dog",
    coach: "practice.coach_2",
    partner: {
      handle: "arjun_up",
      avatar: "a7",
      place: "Lucknow",
      pinch: { x: 0.56, y: 0.63 },
      words: [...w("nose", ["नाक", "hi"]), ...w("dog", ["कुत्ता", "hi"])],
    },
    spots: [
      { x: 0.56, y: 0.63, r: 0.13, words: [...w("nose", ["nose", "en"], ["नाक", "hi"], ["ಮೂಗು", "kn"], ["மூக்கு", "ta"]), ...w("dog", ["dog", "en"])] },
      { x: 0.87, y: 0.4, r: 0.1, words: [...w("eye", ["eye", "en"], ["आँख", "hi"], ["ಕಣ್ಣು", "kn"], ["கண்", "ta"]), ...w("sleepy", ["sleepy", "en"])] },
      { x: 0.16, y: 0.24, r: 0.13, words: w("sun", ["sunlight", "en"], ["धूप", "hi"], ["ಬಿಸಿಲು", "kn"], ["வெயில்", "ta"]) },
    ],
    general: [...w("dog", ["dog", "en"], ["कुत्ता", "hi"], ["ನಾಯಿ", "kn"], ["நாய்", "ta"]), ...w("sleepy", ["sleepy", "en"])],
  },
  {
    photo: "kites-sky",
    coach: "practice.coach_3",
    partner: {
      handle: "priya_gj",
      avatar: "a5",
      place: "Ahmedabad",
      pinch: { x: 0.56, y: 0.37 },
      words: [...w("kite", ["patang", "hi"]), ...w("rainbow", ["rainbow", "en"])],
    },
    spots: [
      { x: 0.56, y: 0.37, r: 0.12, words: [...w("kite", ["kite", "en"], ["पतंग", "hi"], ["ಗಾಳಿಪಟ", "kn"], ["பட்டம்", "ta"]), ...w("rainbow", ["rainbow", "en"])] },
      { x: 0.42, y: 0.56, r: 0.12, words: w("tail", ["tail", "en"], ["पूँछ", "hi"], ["ಬಾಲ", "kn"], ["வால்", "ta"]) },
      { x: 0.82, y: 0.78, r: 0.12, words: w("string", ["string", "en"], ["मांझा", "hi"], ["ದಾರ", "kn"], ["நூல்", "ta"]) },
    ],
    general: [...w("sky", ["sky", "en"], ["आसमान", "hi"], ["ಆಕಾಶ", "kn"], ["வானம்", "ta"]), ...w("kite", ["kite", "en"])],
  },
];

/** What a round leaves behind: did your eyes meet, and did a word you added mean what theirs did. */
export interface PinchOutcome {
  sameSpot: boolean;
  sameMeaning: boolean;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Smart Chips: the words for the spot you pinched (any language), else the photo's general words. */
function chipsFor(round: PracticeRound, at: Point): ChipWord[] {
  const near = [...round.spots].sort((a, b) => dist(a, at) - dist(b, at))[0];
  return near && dist(near, at) <= near.r * 1.5 ? near.words : round.general;
}

function photo(name: string) {
  const v = (px: number) => `/prompts/${name}-${px}.webp`;
  return { src: v(480), srcSet: `${v(320)} 320w, ${v(480)} 480w, ${v(720)} 720w` };
}

/** A big sticker that slaps onto the screen, holds, and peels away. Decorative; never blocks input. */
function Slap({ children, tone = "lime" }: { children: ReactNode; tone?: "lime" | "bubble" | "pinch" }) {
  return (
    <m.div
      aria-hidden
      initial={{ scale: 2.2, opacity: 0, rotate: -14 }}
      animate={{ scale: [2.2, 0.95, 1, 1], opacity: [0, 1, 1, 0], rotate: [-14, -6, -6, -4] }}
      transition={{ duration: 1.1, times: [0, 0.18, 0.7, 1], ease: "easeOut" }}
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
    >
      <span
        className={cn(
          "pop rounded-[28px] border-[6px] px-8 py-4 font-display text-[52px] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap text-ink uppercase",
          { lime: "bg-lime", bubble: "bg-bubble", pinch: "bg-pinch" }[tone],
        )}
      >
        {children}
      </span>
    </m.div>
  );
}

/** "meera_k · Kochi …" — a stranger is out there, right now, looking at the same picture. */
function PartnerChip({ partner, choosing }: { partner: PracticeRound["partner"]; choosing: boolean }) {
  return (
    <div className="pop-sm flex items-center gap-2.5 self-start rounded-full bg-surface py-1.5 pr-4 pl-1.5">
      <Avatar handle={partner.handle} avatar={partner.avatar} size={32} />
      <span className="min-w-0 text-[14px] leading-tight">
        <span className="font-black text-ink">{partner.handle}</span>
        <span className="font-bold text-ink-muted"> · {partner.place}</span>
      </span>
      {choosing ? (
        <span className="flex items-center gap-1 pl-1" role="status" aria-label={t("practice.choosing")}>
          {[0, 1, 2].map((d) => (
            <span
              key={d}
              className="size-1.5 animate-blink rounded-full bg-ink-muted"
              style={{ animationDelay: `${d * 160}ms` }}
            />
          ))}
        </span>
      ) : (
        <span className="rounded-full bg-lime px-2 py-0.5 text-[12px] font-black text-ink">{t("practice.locked")}</span>
      )}
    </div>
  );
}

type Phase = "pinch" | "countdown" | "reveal";

function Round({
  round,
  index,
  onDone,
}: {
  round: PracticeRound;
  index: number;
  onDone: (o: PinchOutcome) => void;
}) {
  const still = useReducedMotion();
  const [mine, setMine] = useState<Point | null>(null);
  const [phase, setPhase] = useState<Phase>("pinch");
  const [count, setCount] = useState(3);
  const [picked, setPicked] = useState<ChipWord[]>([]);
  const [custom, setCustom] = useState("");
  const next = useRef<HTMLButtonElement>(null);
  const img = photo(round.photo);
  const { partner } = round;

  useEffect(() => {
    if (phase === "reveal") next.current?.focus({ preventScroll: true });
  }, [phase]);
  // 3 · 2 · 1 — a beat of suspense before their pinch appears.
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setTimeout(() => (count <= 1 ? setPhase("reveal") : setCount(count - 1)), 330);
    return () => clearTimeout(id);
  }, [phase, count]);

  const sameSpot = !!mine && dist(mine, partner.pinch) <= SAME_SPOT;
  useEffect(() => {
    if (phase === "reveal" && sameSpot) haptic.pinch();
  }, [phase, sameSpot]);

  const place = (p: Point) => {
    if (phase === "pinch") setMine(p);
  };
  const lock = () => {
    if (!mine || phase !== "pinch") return;
    setPhase(still ? "reveal" : "countdown");
  };

  const revealed = phase === "reveal";
  const chips = mine ? chipsFor(round, mine) : [];
  const theirMeanings = new Set(partner.words.map((x) => x.meaning));
  const sameMeaning = picked.some((p) => theirMeanings.has(p.meaning));
  const toggle = (c: ChipWord) => {
    haptic.tick();
    setPicked((ps) =>
      ps.some((p) => p.text === c.text) ? ps.filter((p) => p.text !== c.text) : ps.length >= 3 ? ps : [...ps, c],
    );
  };
  const addCustom = () => {
    const text = custom.trim();
    if (!text || picked.length >= 3 || picked.some((p) => normalize(p.text) === normalize(text))) return;
    // A free word only "means the same" if it's spelled like one of the chips we know for this spot.
    const known = [...chips, ...round.general].find((c) => normalize(c.text) === normalize(text));
    setPicked((ps) => [...ps, { text, lang: detectLang(normalize(text), "en"), meaning: known?.meaning ?? `own:${text}` }]);
    setCustom("");
  };

  const coachLine: Key = revealed ? (sameSpot ? "practice.same_spot" : "practice.diff_spot") : round.coach;

  return (
    <div className="flex flex-1 flex-col gap-2.5">
      {!still ? <Slap tone={index === 1 ? "bubble" : "lime"}>{t("practice.round_label", { n: index + 1 })}</Slap> : null}
      {revealed && sameSpot && !still ? <Slap tone="pinch">{t("play.reveal.exact")}</Slap> : null}

      {/* The stage (D48): the photo fills the screen until you tap, then shrinks to make room for the panel. */}
      <div
        className={cn(
          "relative shrink-0 transition-[height] duration-500 ease-out-soft",
          revealed ? "h-[34dvh] min-h-[200px] short:h-[28dvh]" : "h-[calc(100dvh-140px)] min-h-[320px]",
        )}
      >
        <PinchBoard
          fill
          src={img.src}
          srcSet={img.srcSet}
          sizes="(min-width: 768px) 720px, 180vw"
          mine={mine}
          partner={revealed ? partner.pinch : null}
          revealed={revealed}
          same={sameSpot}
          interactive={phase === "pinch"}
          onPlace={place}
          onTap={(p) => {
            // One tap = locked in (D44), same as the real game.
            if (phase !== "pinch") return;
            setMine(p);
            setPhase(still ? "reveal" : "countdown");
          }}
          onLock={lock}
          countdown={phase === "countdown" ? count : null}
          youLabel={t("play.you")}
          partnerLabel={partner.handle}
          label={t("practice.pinch_label")}
          describedBy="pinch-hint"
        />
        {!revealed ? (
          <>
            {/* Coaching rides on the photo instead of pushing it down. */}
            <p
              id="pinch-hint"
              className="pointer-events-none absolute top-3 right-3 left-3 z-20 rounded-[18px] bg-night/80 px-3.5 py-2 text-[15px] leading-snug font-semibold text-white"
            >
              {t(round.coach)}
            </p>
            <div className="pointer-events-none absolute bottom-3 left-3 z-20">
              <PartnerChip partner={partner} choosing={phase === "pinch"} />
            </div>
          </>
        ) : null}
      </div>

      {revealed ? (
        // The answer panel slides up: result, their words, your words, a note, Next.
        <m.section
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.soft}
          className="pop flex flex-1 flex-col gap-3.5 rounded-[28px] bg-surface p-4"
          aria-label={t("practice.connect")}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 font-display text-[14px] font-black text-ink",
                sameSpot ? "bg-lime" : "bg-sky-soft",
              )}
            >
              {sameSpot ? t("story.same_spot") : t("practice.diff_badge")}
            </span>
            <p className="pt-0.5 text-[14px] leading-snug text-ink-2">{t(coachLine)}</p>
          </div>

          {/* Connect: their words, in their language. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 pb-1">
            <Avatar handle={partner.handle} avatar={partner.avatar} size={30} />
            <span className="text-[14px] font-bold text-ink">{t("practice.they_said", { name: partner.handle })}</span>
            {partner.words.map((x) => (
              <WordBubble
                key={x.text}
                word={x.text}
                lang={x.lang}
                size="sm"
                side="right"
                state={picked.some((p) => p.meaning === x.meaning) ? "matched" : "partner"}
              />
            ))}
          </div>

          {/* Contribute: Smart Chips for the spot you pinched (one scrollable row), or your own word. */}
          <div className="flex flex-col gap-2">
            <p className="text-[14px] font-semibold text-ink-muted">{t("practice.your_words")}</p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
              {chips.map((c) => {
                const on = picked.some((p) => p.text === c.text);
                return (
                  <button
                    key={c.text}
                    type="button"
                    lang={c.lang}
                    aria-pressed={on}
                    onClick={() => toggle(c)}
                    className={cn(
                      "pop-sm press flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[16px] font-bold whitespace-nowrap",
                      on ? "bg-lime text-ink [--lip:var(--color-lime-600)]" : "bg-surface-2 text-ink",
                    )}
                  >
                    {on ? null : <Plus className="size-4" strokeWidth={3} aria-hidden />}
                    {c.text}
                  </button>
                );
              })}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addCustom();
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.slice(0, 30))}
                placeholder={t("practice.custom_placeholder")}
                aria-label={t("practice.custom_placeholder")}
                autoCapitalize="none"
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-4 text-[16px] font-semibold placeholder:text-ink-muted focus-visible:border-brand focus-visible:outline-none"
              />
              <Button type="submit" variant="soft" size="md" disabled={!custom.trim() || picked.length >= 3}>
                {t("practice.add_word")}
              </Button>
            </form>
            {picked.filter((p) => !chips.includes(p)).length ? (
              <div className="flex flex-wrap gap-x-2 gap-y-3 pb-1">
                {picked
                  .filter((p) => !chips.includes(p))
                  .map((p) => (
                    <WordBubble key={p.text} word={p.text} lang={p.lang} size="sm" state="idle" onRemove={() => toggle(p)} removeLabel={t("play.remove", { word: p.text })} />
                  ))}
              </div>
            ) : null}
            {sameMeaning ? (
              <m.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={spring.bouncy}
                className="tilt-l self-start rounded-full bg-bubble px-3 py-1 text-[14px] font-black text-ink"
              >
                {t("practice.same_meaning")}
              </m.p>
            ) : null}
          </div>

          {/* Pinch Notes, practised: a scripted reply shows how the other side answers. */}
          <NoteChips partner={partner} local={{ reply: "haha_same" }} />

          <Button ref={next} variant="play" size="lg" block className="mt-auto" onClick={() => onDone({ sameSpot, sameMeaning })}>
            {index === ROUNDS.length - 1 ? t("practice.finish") : t("play.next")}
          </Button>
        </m.section>
      ) : null}
    </div>
  );
}

function Summary({ pinches, onStart }: { pinches: number; onStart: () => void }) {
  const still = useReducedMotion();
  const rank: Key = pinches >= 3 ? "practice.rank_3" : pinches === 2 ? "practice.rank_2" : "practice.rank_1";
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={spring.bouncy}
      className="relative flex flex-1 flex-col items-center justify-center gap-5 text-center"
    >
      {!still ? <Confetti pieces={22} /> : null}
      <h1 className="max-w-[14ch] text-[40px] leading-[0.95] font-extrabold text-balance text-ink">{t(rank)}</h1>
      <div className="pop tilt-l flex flex-col items-center gap-1 rounded-card bg-marigold px-8 py-5">
        <span className="text-[15px] font-extrabold text-ink-2">{t("practice.shared_moments")}</span>
        <span className="font-display text-[64px] leading-none font-extrabold text-ink tabular-nums">
          {pinches}
        </span>
        <span className="text-[15px] font-bold text-ink-2">{t("practice.pinches", { n: pinches })}</span>
      </div>
      <p className="max-w-[32ch] text-[17px] font-bold text-ink-muted">{t("practice.real_sub")}</p>
      <Button variant="play" size="xl" block onClick={onStart} className="max-w-[380px]">
        {t("practice.start_real")}
      </Button>
    </m.div>
  );
}

export function Practice({ onFinish, onRestore }: { onFinish: () => void; onRestore: () => void }) {
  // -1 = title card, 0..2 = rounds, 3 = summary
  const [i, setI] = useState(-1);
  const [results, setResults] = useState<PinchOutcome[]>([]);
  const playing = i >= 0 && i < ROUNDS.length;
  const pinches = results.filter((r) => r.sameSpot).length;

  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-3 px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))] sm:max-w-[560px] sm:px-6 md:max-w-[620px] md:pt-8 lg:max-w-[620px] xl:max-w-[620px]">
        <header className="flex min-h-10 items-center gap-2">
          {playing ? (
            <>
              <span className="pop-sm rounded-full bg-night px-3 py-1.5 font-display text-[15px] font-extrabold text-white">
                {t("practice.label", { n: i + 1, total: ROUNDS.length })}
              </span>
              <ol className="flex gap-1" aria-hidden>
                {ROUNDS.map((_, j) => (
                  <li
                    key={j}
                    className={cn(
                      "pop-sm size-5 rounded-full",
                      j < i
                        ? !results[j]?.sameSpot
                          ? "bg-ink-faint"
                          : "bg-lime"
                        : j === i
                          ? "bg-bubble"
                          : "bg-surface",
                    )}
                  />
                ))}
              </ol>
            </>
          ) : (
            // Brand bar: on the welcome story and the summary.
            <div className="flex items-center gap-2">
              <Logo size={i < 0 ? 40 : 44} />
              <span className="font-display text-[22px] font-extrabold tracking-tight text-ink">{t("app.name")}</span>
            </div>
          )}
          {i < 0 ? (
            <button
              type="button"
              onClick={onRestore}
              className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-extrabold text-brand hover:bg-brand-soft"
            >
              <RotateCcw className="size-4" strokeWidth={2.5} aria-hidden />
              {t("onboarding.restore")}
            </button>
          ) : null}
        </header>
        {i < 0 ? (
          <Story onStart={() => setI(0)} />
        ) : !playing ? (
          <Summary pinches={pinches} onStart={onFinish} />
        ) : (
          <Round
            key={i}
            round={ROUNDS[i]!}
            index={i}
            onDone={(r) => {
              setResults((rs) => [...rs, r]);
              setI(i + 1);
            }}
          />
        )}
      </div>
    </main>
  );
}
