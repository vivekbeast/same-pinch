// Round timer: a ring that drains. Last 5 s turn marigold — never red (docs/DESIGN_SYSTEM.md §2,
// docs/DECISIONS.md D1). Announces only at 10 s and 5 s (docs/ACCESSIBILITY.md).
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function TimerRing({ left, total, className }: { left: number; total: number; className?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const warn = left <= 5;
  return (
    <div className={cn("relative grid size-14 shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-surface-2" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left / total)}
          className={cn(
            "transition-[stroke-dashoffset] duration-1000 ease-linear",
            warn ? "stroke-marigold" : "stroke-brand",
          )}
        />
      </svg>
      <span className={cn("text-xl font-bold tabular-nums", warn ? "text-marigold-ink" : "text-ink")}>
        {left}
      </span>
      <span className="sr-only" aria-live="polite">
        {left === 10 || left === 5 ? t("play.seconds_left", { n: left }) : ""}
      </span>
    </div>
  );
}
