// /me/badges — the whole badge shelf: earned first, then the locked ones with how to get them.
import { Panel } from "@/components/cards";
import { Medal } from "@/components/medal";
import { Page, PageHeader } from "@/components/page";
import { InlineError } from "@/components/states";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { t, tk } from "@/lib/i18n";
import { useBadges } from "@/lib/queries";

function Shelf() {
  const badges = useBadges();
  if (badges.error) return <InlineError error={badges.error} onRetry={() => badges.refetch()} />;
  if (badges.isPending) return <Skeleton className="h-72 rounded-card" />;
  const { all, earned } = badges.data;
  const sorted = [...all].sort(
    (a, b) => Number(earned.includes(b.id)) - Number(earned.includes(a.id)) || a.sort - b.sort,
  );
  return (
    <Panel className="flex flex-col gap-4 p-4 md:p-6">
      <p className="font-black text-ink">{t("me.badges_count", { n: earned.length, total: all.length })}</p>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6">
        {sorted.map((b, i) => {
          const has = earned.includes(b.id);
          return (
            <li key={b.id} className="flex flex-col items-center gap-1.5 text-center">
              <Medal id={b.id} earned={has} i={i} />
              <span
                className={cn(
                  "text-[14px] leading-tight font-extrabold",
                  has ? "text-ink" : "text-ink-muted",
                )}
              >
                {tk(`badge.${b.id}`)}
              </span>
              {!has ? (
                <span className="text-[12.5px] leading-tight font-semibold text-ink-muted">
                  {tk(`badge.${b.id}.how`)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export default function BadgesPage() {
  return (
    <Page>
      <PageHeader back title={t("me.badges")} />
      <Shelf />
    </Page>
  );
}
