// /me — everything that's yours, in one place (docs/DECISIONS.md D41): who you are (avatar, level, XP),
// then your stuff as four stickers — Wallet, Badges, India map, Flame — each opening its own page.
// Phone: one column that fits a screen. Desktop: identity card pinned left, a 2×2 bento on the right.
import { ChevronRight, Coins, Flame, Map as MapIcon, Settings as SettingsIcon, Snowflake } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { REGIONS } from "@shared";
import { Medal } from "@/components/medal";
import { Avatar } from "@/components/plates";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { number, rupees } from "@/lib/format";
import { t, tk } from "@/lib/i18n";
import { useBadges, useMap } from "@/lib/queries";
import { useMe } from "@/lib/session";

/** One sticker in "your stuff": a big number, a label, and where it leads. */
function StuffTile({
  to,
  tone,
  icon,
  title,
  children,
  cta,
  className,
}: {
  to?: string;
  tone: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  cta?: string;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-bold opacity-80">{title}</span>
        <span className="grid size-9 place-items-center rounded-full bg-surface/70 text-ink [&_svg]:size-5">{icon}</span>
      </span>
      <span className="flex flex-1 flex-col justify-end gap-1">{children}</span>
      {cta ? (
        <span className="flex items-center gap-1 text-[14px] font-bold opacity-80">
          {cta}
          <ChevronRight className="size-4" strokeWidth={2.75} aria-hidden />
        </span>
      ) : null}
    </>
  );
  const cls = cn(
    "pop flex min-h-[124px] flex-col gap-2 rounded-card p-3.5 sm:min-h-[132px] md:min-h-[140px] lg:min-h-[150px] xl:min-h-[180px] xl:p-5",
    tone,
    className,
  );
  return to ? (
    <Link to={to} className={cn(cls, "press")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function Profile() {
  const me = useMe().data!;
  const badges = useBadges();
  const map = useMap();
  const [into, span] = me.level.progress;
  const pct = span ? Math.min(100, Math.round((into / span) * 100)) : 100;
  const earned = badges.data ? badges.data.all.filter((b) => badges.data.earned.includes(b.id)) : [];
  const synced = map.data?.synced.length ?? 0;

  return (
    <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-4 sm:gap-4 md:gap-5 lg:gap-5 xl:grid-cols-12 xl:gap-6">
      <h1 className="sr-only">{t("me.title")}</h1>

      {/* Who you are. Pinned on desktop while the bento scrolls. */}
      <section className="pop relative flex flex-col gap-4 overflow-hidden rounded-card bg-brand p-5 text-white md:p-6 xl:sticky xl:top-8 xl:col-span-5 xl:self-start xl:p-7">
        <div className="flex items-center gap-4">
          <Avatar handle={me.handle} avatar={me.avatar} size={68} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[26px] leading-tight font-black">{me.handle}</p>
            <p className="font-semibold text-white/80">
              {tk(me.level.nameKey)} · Lv {me.level.value}
            </p>
          </div>
          <Link
            to="/me/settings"
            aria-label={t("nav.settings")}
            className="pop-sm press grid size-12 shrink-0 place-items-center rounded-full bg-surface text-ink"
          >
            <SettingsIcon className="size-5" strokeWidth={2.5} />
          </Link>
        </div>
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={span || into}
            aria-valuenow={into}
            aria-label={tk(me.level.nameKey)}
            className="h-4 overflow-hidden rounded-full bg-brand-ink"
          >
            <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[14px] font-semibold text-white/80">
            {number(into)} / {number(span || into)} XP · {number(me.xp)} XP total
          </p>
        </div>
      </section>

      {/* Your stuff: four stickers, each opens its own page. */}
      <section aria-labelledby="stuff" className="flex flex-col gap-3 xl:col-span-7">
        <h2 id="stuff" className="px-1 text-[20px] font-black text-ink md:text-[22px]">
          {t("me.collection")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-4 lg:gap-4 xl:grid-cols-2 xl:gap-5">
          <StuffTile
            to="/me/wallet"
            tone="bg-night text-white [--lip:var(--color-ink)]"
            icon={<Coins strokeWidth={2.5} />}
            title={t("me.wallet")}
            cta={t("me.wallet_cta")}
          >
            <span className="font-display text-[34px] leading-none font-black text-marigold xl:text-[44px]">
              {rupees(me.balancePaise)}
            </span>
          </StuffTile>

          <StuffTile
            to="/me/badges"
            tone="bg-bubble text-ink [--lip:var(--color-bubble-600)]"
            icon={<span className="font-display text-[14px] font-black">{badges.data?.earned.length ?? "…"}</span>}
            title={t("me.badges")}
            cta={badges.data ? t("me.badges_count", { n: badges.data.earned.length }) : undefined}
          >
            {badges.isPending ? (
              <Skeleton className="h-14 w-28 rounded-full bg-surface/50" />
            ) : earned.length ? (
              <span className="flex -space-x-6">
                {earned.slice(0, 3).map((b, i) => (
                  <span key={b.id} className="origin-left scale-[0.66]">
                    <Medal id={b.id} earned i={i} />
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-[14px] font-semibold">{t("me.badges_none")}</span>
            )}
          </StuffTile>

          <StuffTile
            to="/me/map"
            tone="bg-lime-soft text-ink [--lip:var(--color-lime-600)]"
            icon={<MapIcon strokeWidth={2.5} />}
            title={t("me.map")}
            cta={t("me.map_count", { n: synced, total: REGIONS.length })}
          >
            {/* One dot per state/UT, filled as you sync them — a glance, not a map. */}
            <span aria-hidden className="grid w-fit grid-cols-9 gap-1">
              {REGIONS.map((r, i) => (
                <span key={r.code} className={cn("size-2.5 rounded-full", i < synced ? "bg-brand" : "bg-ink/15")} />
              ))}
            </span>
          </StuffTile>

          <StuffTile tone="bg-pinch-soft text-ink" icon={<Flame strokeWidth={2.5} />} title={t("me.flame")}>
            <span className="flex items-end gap-3">
              <span className="font-display text-[40px] leading-none font-black text-pinch-ink xl:text-[48px]">
                {me.flame.value}
              </span>
              <span className="pb-1 text-[14px] leading-tight font-semibold text-ink-2">
                {t("me.flame_best", { n: me.flame.best })}
                <span className="flex items-center gap-1">
                  <Snowflake className="size-3.5" aria-hidden />
                  {me.flame.freezes}
                </span>
              </span>
            </span>
          </StuffTile>
        </div>

      </section>
    </div>
  );
}
