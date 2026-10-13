// Pinch the Picture (docs/DECISIONS.md D39): the photo is the game board. Tap (or arrow keys + Enter) to
// pinch the first thing you notice; on reveal their pinch pops in, with a breathing shared glow when you
// both chose the same spot, or a dashed thread between you when you didn't. Points are 0–1 fractions of
// the (square) photo; the API speaks the 0–1000 grid (toGrid / fromGrid). Lives in animated screens only.
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Hand, ImageOff } from "lucide-react";
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { LIMITS, type api, type z } from "@shared";
import { Confetti } from "@/components/stamp";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { t } from "@/lib/i18n";
import { spring } from "@/lib/motion";

export interface Point {
  x: number;
  y: number;
}
type GridPoint = z.infer<typeof api.PinchPoint>;

export const toGrid = (p: Point): GridPoint => ({ x: Math.round(p.x * LIMITS.pinchGrid), y: Math.round(p.y * LIMITS.pinchGrid) });
export const fromGrid = (p: GridPoint): Point => ({ x: p.x / LIMITS.pinchGrid, y: p.y / LIMITS.pinchGrid });
const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));

/** A pinch marker. The dot sits exactly on the point; the label hangs below (you) or above (them), so
 *  two markers on the same spot never cover each other's names. */
function Marker({ at, tone, label, delay = 0 }: { at: Point; tone: "you" | "them"; label: string; delay?: number }) {
  return (
    <m.span
      aria-hidden
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...spring.bouncy, delay }}
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
    >
      <span className={cn("pop-sm grid size-10 place-items-center rounded-full text-ink", tone === "you" ? "bg-lime" : "bg-bubble")}>
        <Hand className="size-5" strokeWidth={2.75} />
      </span>
      <span
        className={cn(
          "absolute left-1/2 max-w-28 -translate-x-1/2 truncate rounded-full px-2 py-0.5 text-[12px] font-black whitespace-nowrap",
          tone === "you" ? "top-full mt-1 bg-night text-white" : "bottom-full mb-1 bg-bubble text-ink",
        )}
      >
        {label}
      </span>
    </m.span>
  );
}

export function PinchBoard({
  src,
  srcSet,
  sizes = "(min-width: 768px) 420px, 100vw",
  mine,
  partner = null,
  revealed = false,
  same = false,
  interactive,
  onPlace,
  onTap,
  onLock,
  countdown = null,
  youLabel,
  partnerLabel,
  label,
  describedBy,
  tilt = false,
  fill = false,
  className,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  mine: Point | null;
  partner?: Point | null;
  revealed?: boolean;
  same?: boolean;
  interactive: boolean;
  /** Keyboard: arrows move the marker here. Pointer too, unless `onTap` is given. */
  onPlace?: (p: Point) => void;
  /** One-tap play (D44): a tap on the photo IS the answer. */
  onTap?: (p: Point) => void;
  onLock?: () => void;
  countdown?: number | null;
  youLabel: string;
  partnerLabel?: string;
  label: string;
  describedBy?: string;
  tilt?: boolean;
  /** Fill the parent box (any shape): the square photo covers it, centred; coordinates stay the photo's. */
  fill?: boolean;
  className?: string;
}) {
  const still = useReducedMotion();
  // A photo that won't load can't be pinched: say so and let words carry the round.
  const [failed, setFailed] = useState(false);
  const canPinch = interactive && !failed;
  const place = (p: Point) => {
    if (!canPinch || !onPlace) return;
    haptic.tick();
    onPlace({ x: clamp(p.x), y: clamp(p.y) });
  };
  const onPointer = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
    if (onTap) {
      if (!canPinch) return;
      haptic.tick();
      onTap(p);
    } else place(p);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const step = 0.05;
    const at = mine ?? { x: 0.5, y: 0.5 };
    const moves: Record<string, Point> = {
      ArrowLeft: { x: at.x - step, y: at.y },
      ArrowRight: { x: at.x + step, y: at.y },
      ArrowUp: { x: at.x, y: at.y - step },
      ArrowDown: { x: at.x, y: at.y + step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      place(moves[e.key]!);
    } else if (e.key === "Enter" && mine && onLock) {
      e.preventDefault();
      onLock();
    }
  };

  return (
    <div
      className={cn(
        fill
          ? "pop relative size-full overflow-hidden rounded-[24px] bg-surface-2 [container-type:size]"
          : "pop w-full rounded-[18px] bg-surface p-2",
        tilt && "tilt-l",
        className,
      )}
    >
      <div
        role={canPinch ? "application" : "img"}
        tabIndex={canPinch ? 0 : undefined}
        aria-label={failed ? t("play.image_failed") : label}
        aria-describedby={describedBy}
        onPointerDown={canPinch ? onPointer : undefined}
        onKeyDown={canPinch ? onKey : undefined}
        className={cn(
          fill
            ? // A square that covers the box (max of its width and height), centred; the box clips it.
              "absolute top-1/2 left-1/2 size-[max(100cqw,100cqh)] -translate-x-1/2 -translate-y-1/2 select-none"
            : "relative aspect-square overflow-hidden rounded-[12px] bg-surface-2 select-none",
          canPinch && "cursor-crosshair touch-none focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none",
        )}
      >
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt=""
          width={480}
          height={480}
          draggable={false}
          decoding="async"
          fetchPriority="high"
          onError={() => setFailed(true)}
          className={cn("pointer-events-none size-full object-cover", failed && "invisible")}
        />
        {failed ? (
          <span className="absolute inset-0 grid place-items-center gap-2 p-6 text-center text-ink-muted">
            <span className="flex flex-col items-center gap-2">
              <ImageOff className="size-10" strokeWidth={1.75} aria-hidden />
              <span className="font-bold">{t("play.image_failed_words")}</span>
            </span>
          </span>
        ) : null}
        {revealed && !same && mine && partner ? (
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line
              x1={mine.x * 100}
              y1={mine.y * 100}
              x2={partner.x * 100}
              y2={partner.y * 100}
              stroke="white"
              strokeWidth="2.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {revealed && same && mine && partner ? (
          <m.span
            aria-hidden
            className="pointer-events-none absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-lime bg-lime/25"
            style={{ left: `${((mine.x + partner.x) / 2) * 100}%`, top: `${((mine.y + partner.y) / 2) * 100}%` }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={still ? { scale: 1, opacity: 1 } : { scale: [0.2, 1.15, 1, 1.08, 1], opacity: 1 }}
            transition={still ? { duration: 0 } : { duration: 1.6, repeat: Infinity, repeatType: "mirror" }}
          />
        ) : null}
        {mine ? <Marker key={`${mine.x}-${mine.y}`} at={mine} tone="you" label={youLabel} /> : null}
        {revealed && partner ? <Marker at={partner} tone="them" label={partnerLabel ?? ""} delay={0.15} /> : null}
        {revealed && same && mine && partner && !still ? <Confetti pieces={16} /> : null}
        <AnimatePresence>
          {countdown !== null ? (
            <m.span
              key={countdown}
              aria-hidden
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="absolute inset-0 z-20 grid place-items-center bg-night/45 font-display text-[110px] leading-none font-extrabold text-lime"
            >
              {countdown}
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
