import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Segmented control on Radix Tabs: arrow keys, roles and aria-selected for free.
 * The active pill moves with a CSS transform (no layout animation library needed).
 */
export function Segmented<V extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: V;
  onChange: (v: V) => void;
  items: { value: V; label: string; count?: number; icon?: ReactNode }[];
  label: string;
  className?: string;
}) {
  const i = Math.max(
    0,
    items.findIndex((x) => x.value === value),
  );
  return (
    <Tabs.Root value={value} onValueChange={(v) => onChange(v as V)} className={className}>
      <Tabs.List aria-label={label} className="relative flex rounded-full bg-surface-2 p-1 pop-sm">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-full border-2 border-surface bg-lime shadow-[0_3px_0_var(--color-lime-600)] transition-transform duration-300 ease-out-soft"
          style={{ width: `calc((100% - 8px) / ${items.length})`, transform: `translateX(${i * 100}%)` }}
        />
        {items.map((it) => (
          <Tabs.Trigger
            key={it.value}
            value={it.value}
            className={cn(
              "relative z-10 flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-1 text-[14.5px] font-extrabold text-ink-muted sm:text-[15px]",
              "focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none data-[state=active]:text-ink",
            )}
          >
            {it.icon}
            {it.label}
            {it.count ? (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand-ink">
                {it.count}
              </span>
            ) : null}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
