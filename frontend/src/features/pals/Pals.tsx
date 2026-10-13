// /people (docs/DECISIONS.md D44): the people whose thoughts met yours — real partners from your rounds —
// then this week's India board (XP only, never ₹). No city/state scopes: nobody is asked for an address.
// Phone: one column. Desktop: people on the left (7/12), the board on the right (5/12).
import { HeartHandshake, Languages, Trophy } from "lucide-react";
import { REGIONS } from "@shared";
import { PinchGlyph } from "@/components/brand";
import { NightCard, Panel } from "@/components/cards";
import { Page, PageHeader } from "@/components/page";
import { Avatar } from "@/components/plates";
import { EmptyState, errorText, InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { number } from "@/lib/format";
import { t, tk, tn } from "@/lib/i18n";
import { useLeaderboard, usePeople } from "@/lib/queries";
import { NotesInbox } from "./NotesInbox";
import { useMe } from "@/lib/session";
import { usePackStarter } from "@/lib/start-pack";
import { toast } from "@/lib/toast";

const LEVEL_KEYS = ["level.stranger", "level.same_wave", "level.mind_reader", "level.telepath", "level.pinch_oracle"];
const regionName = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? "";

type Row = { rank: number; handle: string; avatar: string; level: number; xp: number };

const MOMENT_TONE = { exact: "bg-lime", bhasha: "bg-bubble", spot: "bg-sky-soft" } as const;

/** People you've pinched with: one sticker each, newest first. */
function PinchedWith() {
  const people = usePeople();
  const start = usePackStarter();
  if (people.error) return <InlineError error={people.error} onRetry={() => people.refetch()} />;
  if (people.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (!people.data.people.length) {
    return (
      <EmptyState
        icon={HeartHandshake}
        line={t("people.empty")}
        action={
          <Button
            variant="play"
            size="md"
            busy={start.isPending}
            onClick={() => start.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}
          >
            {start.isPending ? null : <PinchGlyph className="size-6" />}
            {t("nav.play")}
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 md:gap-3 lg:grid-cols-2 xl:grid-cols-2 xl:gap-3">
      {people.data.people.map((p) => (
        <li key={p.handle} className="pop-sm flex items-center gap-3 rounded-tile bg-surface p-3">
          <Avatar handle={p.handle} avatar={p.avatar} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold text-ink">{p.handle}</span>
            <span className="block truncate text-[14px] text-ink-muted">
              {[regionName(p.stateCode), tn("people.moments", p.moments)].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold text-ink", MOMENT_TONE[p.last])}>
            {p.last === "bhasha" ? <Languages className="size-3.5" aria-hidden /> : null}
            {t(`people.last.${p.last}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Top three on a podium: 2 · 1 · 3, the winner tallest. */
function Podium({ rows, me }: { rows: Row[]; me: string }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as Row[];
  const height: Record<number, string> = { 1: "h-20 md:h-24", 2: "h-14 md:h-16", 3: "h-10 md:h-12" };
  const tone: Record<number, string> = { 1: "bg-marigold", 2: "bg-sky-soft", 3: "bg-pinch-soft" };
  return (
    <ol className="flex items-end justify-center gap-2 md:gap-3" aria-label={t("people.board")}>
      {order.map((r) => (
        <li key={r.handle} className="flex w-1/3 max-w-[140px] flex-col items-center gap-1">
          <Avatar handle={r.handle} avatar={r.avatar} size={r.rank === 1 ? 52 : 42} />
          <span className={cn("max-w-full truncate text-[13px] font-bold", r.handle === me ? "text-brand" : "text-ink")}>
            {r.handle}
          </span>
          <span
            className={cn(
              "pop grid w-full place-items-start justify-center rounded-t-[16px] rounded-b-[6px] pt-1.5 font-display text-[22px] font-black text-ink",
              height[r.rank],
              tone[r.rank],
            )}
          >
            {r.rank}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** This week, all of India, by XP. */
function Board() {
  const me = useMe().data!;
  const board = useLeaderboard("india");
  if (board.error) return <InlineError error={board.error} onRetry={() => board.refetch()} />;
  if (board.isPending) return <Skeleton className="h-64 rounded-card" />;
  const { top } = board.data;
  if (!top.length) return <EmptyState icon={Trophy} line={t("pals.empty")} />;
  return (
    <div className="flex flex-col gap-3">
      <Podium rows={top.slice(0, 3)} me={me.handle} />
      {board.data.me ? (
        <NightCard numeral={board.data.me.rank} title={t("pals.you")} sub={t("pals.xp", { xp: number(board.data.me.xp) })} />
      ) : null}
      {top.length > 3 ? (
        <Panel as="ul">
          {top.slice(3, 10).map((r) => (
            <li key={r.handle} className={cn("group flex items-center gap-3 pl-3", r.handle === me.handle && "bg-lime-soft")}>
              <span className="w-7 shrink-0 text-center font-display text-[17px] font-black text-ink-muted">{r.rank}</span>
              <Avatar handle={r.handle} avatar={r.avatar} size={32} />
              <span className="flex min-h-13 flex-1 items-center gap-2 border-b-2 border-line py-2 pr-3 group-last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{r.handle}</span>
                  <span className="block text-[13px] text-ink-muted">{tk(LEVEL_KEYS[r.level - 1] ?? "level.stranger")}</span>
                </span>
                <span className="font-display text-[15px] font-bold text-ink">{t("pals.xp", { xp: number(r.xp) })}</span>
              </span>
            </li>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

export default function Pals() {
  return (
    <Page wide>
      <PageHeader title={t("pals.title")} sub={t("people.sub")} />
      <div className="grid grid-cols-1 gap-5 sm:gap-5 md:gap-6 lg:gap-6 xl:grid-cols-12 xl:gap-8">
        <div className="flex flex-col gap-5 xl:col-span-7">
        <NotesInbox />
        <section aria-labelledby="pinched-with" className="flex flex-col gap-2.5">
          <h2 id="pinched-with" className="text-[19px] font-black text-ink md:text-[21px]">
            {t("people.pinched_with")}
          </h2>
          <PinchedWith />
        </section>
        </div>
        <section aria-labelledby="board" className="flex flex-col gap-2.5 xl:col-span-5">
          <h2 id="board" className="text-[19px] font-black text-ink md:text-[21px]">
            {t("people.board")}
          </h2>
          <Board />
        </section>
      </div>
    </Page>
  );
}
