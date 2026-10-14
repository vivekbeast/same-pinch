// "Pinched with lately": the newest people you've shared a moment with, as cards (Home) or rows (Me).
// Desktop fillers that carry real content (D55); handles and states only, never ids.
import { ChevronRight, Languages } from "lucide-react";
import { Link } from "react-router";
import { REGIONS } from "@shared";
import { Avatar } from "@/components/plates";
import { cn } from "@/lib/cn";
import { t, tn } from "@/lib/i18n";
import { usePeople } from "@/lib/queries";

const regionName = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? "";
const TONE = { exact: "bg-lime", bhasha: "bg-bubble", spot: "bg-sky-soft" } as const;

export function RecentPeople({
  limit = 4,
  variant = "cards",
  className,
}: {
  limit?: number;
  variant?: "cards" | "rows";
  className?: string;
}) {
  const people = usePeople().data?.people.slice(0, limit) ?? [];
  if (!people.length) return null;
  return (
    <section aria-labelledby="recent-people" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="recent-people" className="text-[20px] font-black text-ink">
          {t("people.pinched_with")}
        </h2>
        <Link
          to="/people"
          className="flex items-center gap-0.5 rounded-full px-2 py-1 text-[14px] font-black text-brand hover:bg-brand-soft"
        >
          {t("nav.people")}
          <ChevronRight className="size-4" strokeWidth={3} aria-hidden />
        </Link>
      </div>
      <ul
        className={
          variant === "cards"
            ? "grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 xl:gap-4"
            : "flex flex-col overflow-hidden rounded-card bg-surface pop-sm"
        }
      >
        {people.map((p) => (
          <li
            key={p.handle}
            className={cn(
              "bg-surface",
              variant === "cards"
                ? // Avatar on the left; name, state and the moment chip stacked beside it — nothing gets cut off.
                  "grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-tile p-3 pop-sm"
                : "flex items-center gap-3 border-b-2 border-line px-4 py-2.5 last:border-0",
            )}
          >
            <Avatar
              handle={p.handle}
              avatar={p.avatar}
              size={40}
              className={variant === "cards" ? "row-span-2" : undefined}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold text-ink">{p.handle}</span>
              <span className="block truncate text-[13px] text-ink-muted">
                {variant === "cards"
                  ? regionName(p.stateCode)
                  : [regionName(p.stateCode), tn("people.moments", p.moments)].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold text-ink",
                variant === "cards" && "col-start-2 justify-self-start",
                TONE[p.last],
              )}
            >
              {p.last === "bhasha" ? <Languages className="size-3.5" aria-hidden /> : null}
              {t(`people.last.${p.last}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
