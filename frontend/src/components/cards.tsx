// Card family, party edition (docs/UI_DIRECTION.md v2): every card has an ink outline and a hard shadow;
// weight comes from fill colour — night (hero), brand (daily challenge), white (lists), tiles (stats).
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Dark hero card with one giant numeral. */
export function NightCard({
  numeral,
  numeralTone = "pinch",
  title,
  sub,
  chips,
  action,
  aside,
  className,
}: {
  numeral?: ReactNode;
  numeralTone?: "pinch" | "success" | "marigold";
  title: string;
  sub?: string;
  chips?: ReactNode;
  action?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-card bg-night p-5 text-white pop md:p-6 xl:p-7",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {numeral != null ? (
          <span
            className={cn(
              "text-numeral leading-[0.82] font-black tracking-[-0.03em] xl:text-[104px]",
              { pinch: "text-pinch", success: "text-success-bright", marigold: "text-marigold" }[numeralTone],
            )}
          >
            {numeral}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
          <h2 className="text-section font-black">{title}</h2>
          {sub ? <p className="font-semibold text-white/75">{sub}</p> : null}
        </div>
        {aside}
      </div>
      {chips ? <div className="mt-4 flex flex-wrap gap-2">{chips}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function NightChip({
  icon,
  children,
  tone = "plain",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "plain" | "pinch" | "marigold";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[15px] font-bold",
        tone === "pinch"
          ? "bg-pinch/20"
          : tone === "marigold"
            ? "bg-marigold/20 text-marigold"
            : "bg-white/10",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Today's challenge (Think Like India): solid violet card. */
export function DailyCard({
  icon,
  title,
  sub,
  action,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-card bg-brand p-4 text-white pop md:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid size-13 shrink-0 place-items-center rounded-icon bg-marigold text-ink pop-sm">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[21px] leading-tight font-black">{title}</h3>
          <p className="font-semibold text-white/80">{sub}</p>
        </div>
        {action}
      </div>
      {children ? <div className="mt-3 flex flex-col items-start gap-2">{children}</div> : null}
    </section>
  );
}

/** White card for lists and forms. */
export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "ul";
}) {
  return <Tag className={cn("overflow-hidden rounded-card bg-surface pop", className)}>{children}</Tag>;
}

export function SectionHeader({
  title,
  count,
  action,
  id,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <h2 id={id} className="flex items-center gap-2.5 text-[21px] font-black text-ink md:text-section">
        {title}
        {count != null ? (
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-ink px-2 text-[14px] font-black text-white">
            {count}
          </span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

/** Row inside a Panel. The divider starts at the text, not under the icon. */
export function Row({
  icon,
  title,
  sub,
  trailing,
  onClick,
  chevron = !!onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "group flex w-full items-center gap-4 pl-4 text-left",
        onClick && "cursor-pointer hover:bg-surface-2/60 active:bg-surface-2",
      )}
    >
      {icon}
      <span className="flex min-h-16 flex-1 items-center gap-3 border-b-2 border-line py-3 pr-4 group-last:border-0">
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-bold text-ink">{title}</span>
          {sub ? <span className="block text-[15px] font-semibold text-ink-muted">{sub}</span> : null}
        </span>
        {trailing}
        {chevron ? <ChevronRight className="size-5 text-ink-muted" strokeWidth={2.5} aria-hidden /> : null}
      </span>
    </Tag>
  );
}

export function IconTile({
  children,
  tone = "soft",
  className,
}: {
  children: ReactNode;
  tone?: "soft" | "night" | "success" | "marigold" | "danger" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-icon border-2 border-surface [&_svg]:size-6",
        {
          soft: "bg-brand-soft text-brand-ink",
          night: "bg-night text-white",
          success: "bg-success-soft text-success",
          marigold: "bg-marigold text-ink",
          danger: "bg-danger-soft text-danger",
          neutral: "bg-surface-2 text-ink-2",
        }[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatTile({
  value,
  label,
  icon,
  tone = "ink",
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
  tone?: "ink" | "reward" | "success" | "brand";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-tile p-3.5 pop-sm md:p-4",
        { ink: "bg-surface", reward: "bg-marigold-soft", success: "bg-success-soft", brand: "bg-brand-soft" }[
          tone
        ],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-[clamp(26px,4vw,38px)] leading-none font-black",
            {
              ink: "text-ink",
              reward: "text-marigold-ink",
              success: "text-success",
              brand: "text-brand-ink",
            }[tone],
          )}
        >
          {value}
        </span>
        {icon ? <span className="text-ink-muted [&_svg]:size-5">{icon}</span> : null}
      </div>
      <p className="text-[14px] font-bold text-ink-muted">{label}</p>
    </div>
  );
}

/** Ledger row as a ticket stub: perforated left edge. */
export function Ticket({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-tile border-y-2 border-r-2 border-surface bg-surface ticket-edge py-3 pr-4 pl-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
