import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

/** The only spinner: buttons and small areas, never full screen (docs/UX_STATES.md §3). */
export function Spinner({ className, label = t("common.loading") }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex", className)}>
      <svg viewBox="0 0 24 24" className="size-full animate-spin" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeOpacity=".2"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M22 12a10 10 0 0 0-10-10"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Shape-matched placeholder. Shimmer is off under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-tile bg-surface-2 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/.55),transparent)] bg-[length:200%_100%] motion-reduce:animate-none",
        className,
      )}
    />
  );
}
