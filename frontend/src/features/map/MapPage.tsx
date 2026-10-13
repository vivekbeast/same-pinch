// /map — the Plate Map (docs/UI_DIRECTION.md §2). India as 36 state-code plates placed roughly where
// each state sits. Crisp plate = synced, dashed = not yet, marigold ring = new in the last 24 h.
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { MapPinned } from "lucide-react";
import { useMemo, useState } from "react";
import { REGIONS, ZONES, type Zone } from "@shared";
import { Panel } from "@/components/cards";
import { Page, PageHeader } from "@/components/page";
import { StatePlate, type StateStatus } from "@/components/plates";
import { EmptyState, InlineError } from "@/components/states";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { t, tn, type Key } from "@/lib/i18n";
import { useMap } from "@/lib/queries";
import { useFamily } from "@/lib/use-family";
import { useNow } from "@/lib/use-now";

/** Tile-grid layout of India: [column, row] on a 9 × 8 grid. Approximate on purpose — it's a cartogram. */
const TILE: Record<string, [number, number]> = {
  JK: [2, 0],
  LA: [3, 0],
  PB: [1, 1],
  HP: [2, 1],
  UK: [3, 1],
  CH: [1, 2],
  HR: [2, 2],
  DL: [3, 2],
  UP: [4, 2],
  BR: [5, 2],
  SK: [6, 2],
  AS: [7, 2],
  AR: [8, 2],
  RJ: [2, 3],
  MP: [3, 3],
  CG: [4, 3],
  JH: [5, 3],
  WB: [6, 3],
  ML: [7, 3],
  NL: [8, 3],
  GJ: [1, 4],
  DH: [2, 4],
  MH: [3, 4],
  TG: [4, 4],
  OD: [5, 4],
  TR: [7, 4],
  MN: [8, 4],
  GA: [2, 5],
  KA: [3, 5],
  AP: [4, 5],
  MZ: [8, 5],
  LD: [1, 6],
  KL: [3, 6],
  TN: [4, 6],
  PY: [5, 6],
  AN: [7, 7],
};

type Filter = "all" | "synced" | "notyet";
const DAY = 86_400_000;

export default function MapPage() {
  const family = useFamily();
  const map = useMap();
  const [filter, setFilter] = useState<Filter>("all");
  const [focus, setFocus] = useState<string | null>(null);
  const now = useNow();

  const status = useMemo(() => {
    const s = new Map<string, { status: StateStatus; pinches: number }>();
    for (const r of map.data?.synced ?? []) {
      s.set(r.stateCode, {
        status: now - Date.parse(r.firstAt) < DAY ? "new" : "synced",
        pinches: r.pinches,
      });
    }
    return s;
  }, [map.data, now]);

  if (map.isPending) {
    return (
      <Page>
        <Skeleton className="h-11 w-40" />
        <Skeleton className="aspect-[9/6] rounded-card" />
      </Page>
    );
  }
  if (map.error) return <InlineError error={map.error} onRetry={() => map.refetch()} />;

  const synced = status.size;
  const of = (code: string) => status.get(code) ?? { status: "notyet" as const, pinches: 0 };
  const interactive = family !== "phone";

  const plateMap = (
    <Panel className="p-4 md:p-6">
      <div
        className="grid grid-cols-9 gap-1.5 md:gap-2"
        role={interactive ? "group" : undefined}
        aria-hidden={!interactive || undefined}
      >
        {REGIONS.map((r) => {
          const [col, row] = TILE[r.code]!;
          const s = of(r.code);
          return (
            <div
              key={r.code}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
              className={cn("transition-opacity", focus && focus !== r.code && "opacity-40")}
            >
              <StatePlate
                code={r.code}
                name={r.name}
                status={s.status}
                pinches={s.pinches}
                onClick={interactive ? () => setFocus(focus === r.code ? null : r.code) : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="size-4 rounded-[4px] border-2 border-surface bg-brand" aria-hidden />{" "}
          {t("map.status.synced")}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-4 rounded-[4px] border-2 border-surface bg-marigold" aria-hidden />{" "}
          {t("map.status.new")}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-5 rounded-[3px] border-[1.5px] border-dashed border-line" aria-hidden />{" "}
          {t("map.status.notyet")}
        </span>
      </div>
    </Panel>
  );

  const shown = REGIONS.filter((r) =>
    focus
      ? r.code === focus
      : filter === "all"
        ? true
        : filter === "synced"
          ? status.has(r.code)
          : !status.has(r.code),
  );
  const byZone = ZONES.map((z) => [z, shown.filter((r) => r.zone === z)] as const).filter(
    ([, rs]) => rs.length,
  );

  const list = (
    <div className="flex flex-col gap-5">
      <ToggleGroup.Root
        type="single"
        value={filter}
        onValueChange={(v) => {
          if (v) setFilter(v as Filter);
          setFocus(null);
        }}
        aria-label={t("map.title")}
        className="-mx-5 scrollbar-none flex snap-x gap-2 overflow-x-auto px-5 md:mx-0 md:px-0"
      >
        {(["all", "synced", "notyet"] as const).map((f) => (
          <ToggleGroup.Item
            key={f}
            value={f}
            className="h-11 shrink-0 snap-start rounded-full bg-surface px-5 text-[15px] font-medium text-ink pop-sm data-[state=on]:bg-brand data-[state=on]:text-white"
          >
            {t(`map.filter.${f}`)}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>

      {synced === 0 && filter !== "notyet" ? <EmptyState icon={MapPinned} line={t("map.empty")} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {byZone.map(([zone, rs]) => (
          <section key={zone} aria-labelledby={`zone-${zone}`} className="flex flex-col gap-2">
            <h2 id={`zone-${zone}`} className="px-1 text-2xl font-bold">
              {t(`map.zone.${zone as Zone}` as Key)}
            </h2>
            <Panel as="ul">
              {rs.map((r) => {
                const s = of(r.code);
                return (
                  <li key={r.code} className="group flex items-center gap-4 pl-4">
                    <span className="w-14 shrink-0">
                      <StatePlate
                        code={r.code}
                        name={r.name}
                        status={s.status}
                        pinches={s.pinches}
                        showCount
                      />
                    </span>
                    <span className="flex min-h-16 flex-1 items-center gap-3 border-b border-line py-3 pr-4 group-last:border-0">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-medium text-ink">{r.name}</span>
                        {s.pinches ? (
                          <span className="block text-[15px] text-ink-muted">
                            {tn("map.pinched", s.pinches)}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-sm font-semibold",
                          s.status === "new"
                            ? "bg-pinch-soft text-pinch-ink"
                            : s.status === "synced"
                              ? "bg-success-soft text-success"
                              : "border border-dashed border-line text-ink-muted",
                        )}
                      >
                        {t(`map.status.${s.status}`)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </Panel>
          </section>
        ))}
      </div>
    </div>
  );

  const progress = (
    <Panel className="flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-ink">{t("map.progress", { n: synced })}</span>
        <span className="text-2xl font-bold text-brand">{Math.round((synced / 36) * 100)}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={36}
        aria-valuenow={synced}
        aria-label={t("map.progress", { n: synced })}
        className="h-3 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-brand" style={{ width: `${(synced / 36) * 100}%` }} />
      </div>
    </Panel>
  );

  return (
    <Page>
      <PageHeader back title={t("map.title")} sub={t("map.sub", { n: synced })} />
      {plateMap}
      {progress}
      {list}
    </Page>
  );
}
