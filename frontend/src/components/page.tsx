// Page frame: title + one line. Pages under Me (wallet, badges, map, settings) get a "‹ Me" back link.
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

export function Page({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5 sm:gap-5 md:gap-7 lg:gap-7 xl:gap-8",
        wide ? "max-w-[1180px]" : "max-w-[880px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BackToMe() {
  return (
    <Link
      to="/me"
      className="flex w-fit items-center gap-1 rounded-full py-1 pr-3 text-[15px] font-bold text-brand hover:bg-brand-soft"
    >
      <ChevronLeft className="size-5" strokeWidth={2.5} aria-hidden />
      {t("nav.me")}
    </Link>
  );
}

export function PageHeader({
  title,
  sub,
  lead,
  actions,
  back = false,
}: {
  title: string;
  sub?: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Sub-page of Me: show the "‹ Me" link above the title. */
  back?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 flex-col gap-1">
        {back ? <BackToMe /> : null}
        {lead}
        <h1 className="text-[28px] leading-tight font-black text-ink sm:text-[28px] md:text-[32px] lg:text-[34px] xl:text-[38px]">{title}</h1>
        {sub ? <p className="text-[16px] text-ink-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2 pt-1">{actions}</div> : null}
    </header>
  );
}
