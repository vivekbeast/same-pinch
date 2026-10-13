// The one loud moment (docs/UI_DIRECTION.md v3): a starburst sticker "SAME PINCH!" gets slapped onto the
// screen (big → small, like a hand pressing it down), plus confetti. Lives only in screens that animate (Motion is lazy-loaded with them).
import { m } from "motion/react";
import { cn } from "@/lib/cn";

/** 16-point starburst polygon in a 200×120 box. */
const BURST = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2;
  const r = i % 2 === 0 ? 1 : 0.78;
  return `${(100 + Math.cos(a) * 98 * r).toFixed(1)},${(60 + Math.sin(a) * 58 * r).toFixed(1)}`;
}).join(" ");

export function PinchStamp({
  variant,
  label,
  className,
}: {
  variant: "exact" | "bhasha";
  label: string;
  className?: string;
}) {
  const fill = variant === "bhasha" ? "var(--color-bubble)" : "var(--color-lime)";
  return (
    <m.div
      role="img"
      aria-label={label}
      // Pops in, holds, then gets out of the way so the matched words show.
      initial={{ scale: 2.4, opacity: 0, rotate: -18 }}
      animate={{ scale: [2.4, 0.94, 1.03, 1, 0.92], opacity: [0, 1, 1, 1, 0], rotate: [-18, -5, -7, -6, -6] }}
      transition={{ duration: 2.5, times: [0, 0.09, 0.15, 0.8, 1], ease: "easeOut" }}
      className={cn("pointer-events-none relative grid place-items-center select-none", className)}
    >
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
        aria-hidden
      >
        {/* Sticker: soft lifted shadow, a thick white die-cut edge, then the colour. */}
        <polygon points={BURST} fill="rgb(21 19 64 / 0.22)" transform="translate(0 7)" />
        <polygon points={BURST} fill="#fff" stroke="#fff" strokeWidth="14" strokeLinejoin="round" />
        <polygon points={BURST} fill={fill} />
      </svg>
      <span className="relative px-12 py-8 text-center font-display text-[clamp(26px,7vw,40px)] leading-[0.95] font-extrabold tracking-[-0.03em] whitespace-nowrap text-ink uppercase">
        {label}
      </span>
    </m.div>
  );
}

const COLORS = [
  "var(--color-lime)",
  "var(--color-pinch)",
  "var(--color-bubble)",
  "var(--color-brand)",
  "var(--color-marigold)",
  "var(--color-sky)",
];

/** A one-shot burst of chunky confetti (12–20 pieces, transforms only — cheap on low-end phones). */
export function Confetti({ pieces = 18, className }: { pieces?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}>
      {Array.from({ length: pieces }, (_, i) => {
        const angle = (i / pieces) * Math.PI * 2 + (i % 3) * 0.2;
        const dist = 110 + (i % 4) * 30;
        return (
          <m.span
            key={i}
            className={cn("absolute top-1/2 left-1/2 block", i % 3 === 0 ? "rounded-full" : "rounded-[3px]")}
            style={{ width: i % 2 ? 10 : 14, height: i % 2 ? 14 : 10, background: COLORS[i % COLORS.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist + 60,
              opacity: 0,
              rotate: 260 + i * 25,
              scale: 1,
            }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        );
      })}
    </div>
  );
}
