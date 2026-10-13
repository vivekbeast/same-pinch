// Every screen's plan B (docs/UX_STATES.md): empty = icon + one line + one action; error = inline, with retry.
import { CloudOff, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { t, type Key } from "@/lib/i18n";
import { Button } from "./ui/button";

export function EmptyState({
  icon: Icon,
  line,
  action,
  className,
}: {
  icon: LucideIcon;
  line: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-4 rounded-card bg-surface p-6 pop-sm", className)}>
      <span className="grid size-14 place-items-center rounded-icon bg-brand-soft text-brand">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <p className="max-w-[40ch] text-[17px] text-ink-2">{line}</p>
      {action}
    </div>
  );
}

export const errorText = (e: unknown) => t(`errors.${e instanceof ApiError ? e.code : "INTERNAL"}` as Key);

export function InlineError({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const offline = error instanceof ApiError && error.code === "NETWORK";
  const Icon = offline ? CloudOff : TriangleAlert;
  return (
    <div
      role="alert"
      className={cn("flex items-center gap-4 rounded-tile bg-danger-soft p-4 text-danger", className)}
    >
      <Icon className="size-6 shrink-0" strokeWidth={1.75} />
      <p className="flex-1 text-[15px] font-medium">{errorText(error)}</p>
      {onRetry ? (
        <Button size="sm" variant="danger" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
