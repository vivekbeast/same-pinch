// /play/:packId/done — Results (docs/UI_DIRECTION.md v2 §3). Score + earnings count up; Collect makes it
// count; then each reward (flame, level, badge, new state) pops one by one; Play again is the big button.
import { useMutation, useQuery } from "@tanstack/react-query";
import { m } from "motion/react";
import { CheckCheck, Flame, House, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { REGIONS, api as contract, type z } from "@shared";
import { PinchGlyph } from "@/components/brand";
import { Mascot } from "@/components/mascot";
import { withMotion } from "@/components/motion-root";
import { StatePlate } from "@/components/plates";
import { RewardQueue, useCountUp, type Reward } from "@/components/rewards";
import { errorText, InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { WordBubble } from "@/components/words";
import { Medal } from "@/components/medal";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { track } from "@/lib/events";
import { rupees } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { t, tk, tn } from "@/lib/i18n";
import { noteCollected } from "@/lib/install";
import { spring } from "@/lib/motion";
import { queryClient } from "@/lib/query";
import { loadRoundResults, type StoredRound } from "@/lib/round-store";
import { sound } from "@/lib/sound";
import { usePackStarter } from "@/lib/start-pack";
import { toast } from "@/lib/toast";
import { useFamily } from "@/lib/use-family";

type Summary = z.infer<typeof contract.CollectResponse>;
const regionName = (code: string | null) => REGIONS.find((r) => r.code === code)?.name ?? "";
const isPinch = (r: StoredRound) => r.result.result === "exact" || r.result.result === "bhasha";

function MatchRow({ r }: { r: StoredRound }) {
  const res = r.result;
  const yours = res.you.filter((w) => w.matched);
  const theirs = res.partner?.words.filter((w) => w.matched) ?? [];
  return (
    <li className="flex flex-col gap-2.5 rounded-tile bg-surface p-3.5 pop-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[14px] font-bold text-ink-muted">{tk(r.textKey)}</p>
        <span className="shrink-0 text-[17px] font-black text-marigold-ink">{rupees(res.earnPaise)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 pb-1">
        {yours.map((w) => (
          <WordBubble key={`y-${w.text}`} word={w.text} lang={w.lang} size="sm" state="matched" />
        ))}
        <span className="text-xl font-black text-ink" aria-hidden>
          =
        </span>
        {theirs.map((w) => (
          <WordBubble
            key={`p-${w.text}`}
            word={w.text}
            lang={w.lang}
            size="sm"
            state="matched"
            side="right"
          />
        ))}
      </div>
      {res.partner ? (
        <p className="truncate text-[14px] font-semibold text-ink-2">
          {t("results.with", { handle: res.partner.handle, state: regionName(res.partner.stateCode) })}
        </p>
      ) : null}
    </li>
  );
}

/** Turns the collect summary into the popup queue. */
function rewardsFrom(s: Summary): Reward[] {
  const out: Reward[] = [];
  if (s.flame.increased)
    out.push({
      id: "flame",
      tone: "pinch",
      art: <Flame className="size-20 fill-marigold text-ink" strokeWidth={2} aria-hidden />,
      title: t("results.flame_up", { n: s.flame.value }),
    });
  if (s.flame.freezeUsed)
    out.push({
      id: "freeze",
      tone: "brand",
      art: <Snowflake className="size-20 text-white" strokeWidth={2} aria-hidden />,
      title: t("results.freeze_used"),
    });
  if (s.level.leveledUp)
    out.push({
      id: "level",
      tone: "marigold",
      art: <Mascot pose="cheer" size={120} />,
      title: t("results.level_up", { name: tk(s.level.nameKey) }),
      sub: `Lv ${s.level.value}`,
    });
  s.newBadges.forEach((b, i) =>
    out.push({
      id: `badge-${b}`,
      tone: "brand",
      art: <Medal id={b} earned i={i} size="lg" />,
      title: tk(`badge.${b}`),
      sub: t("results.badges"),
    }),
  );
  if (s.newRegions.length)
    out.push({
      id: "regions",
      tone: "success",
      title: t("results.regions"),
      sub: s.newRegions.map(regionName).join(", "),
      art: (
        <span className="flex gap-2">
          {s.newRegions.slice(0, 3).map((c) => (
            <span key={c} className="w-16">
              <StatePlate code={c} name={regionName(c)} status="new" />
            </span>
          ))}
        </span>
      ),
    });
  return out;
}

function Results() {
  const { packId = "" } = useParams();
  const family = useFamily();
  const start = usePackStarter();
  // Rounds still in the offline queue must reach the server before the pack can be collected.
  const queued = useQuery({
    queryKey: ["queue", packId],
    queryFn: async () => (await import("@/lib/offline")).queuedFor(packId),
  });
  const waiting = queued.data?.length ?? 0;
  const [initial] = useState(() => loadRoundResults(packId));
  const rounds = useMemo(
    () => (waiting === 0 ? loadRoundResults(packId) : initial).filter((r): r is StoredRound => !!r),
    [waiting, packId, initial],
  );
  const pinches = rounds.filter(isPinch);
  // Pinch the Picture (D39): rounds where your eyes met, words or not.
  const sameSpots = rounds.filter((r) => r.result.spot?.same).length;

  const collect = useMutation({
    mutationFn: () => api(`/packs/${packId}/collect`, { method: "POST", schema: "CollectResponse" }),
    onSuccess: async (s) => {
      track("pack_collect", { pinches: s.pinches, paid: s.paid });
      if (s.level.leveledUp) {
        haptic.level();
        sound.level();
      } else haptic.tap();
      noteCollected();
      await (await import("@/lib/offline")).forgetPack(packId);
      for (const key of [["me"], ["ledger"], ["wallet"], ["map"], ["leaderboard"], ["badges"], ["people"]])
        void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const done = collect.data;
  const rewards = useMemo(() => (done ? rewardsFrom(done) : []), [done]);

  const shownPinches = useCountUp(done ? done.pinches : pinches.length);
  const shownSpots = useCountUp(sameSpots);
  const good = pinches.length > 0 || sameSpots > 0;

  const score = (
    <section
      className={cn(
        "relative flex flex-col items-center gap-2 overflow-hidden rounded-card px-5 pt-5 pb-6 text-center pop",
        good ? "bg-marigold" : "bg-surface",
      )}
    >
      <h1 className="text-[30px] leading-tight font-black text-ink">
        {good ? t("results.title") : t("results.title_none")}
      </h1>
      <div className="flex items-stretch gap-3">
        <div className="flex min-w-[118px] flex-col items-center rounded-tile bg-surface px-4 py-2.5 pop-sm">
          <span className="text-[44px] leading-none font-black text-ink tabular-nums">
            {shownPinches}
            <span className="text-[22px] text-ink-muted">/{rounds.length || 10}</span>
          </span>
          <span className="text-[13px] font-extrabold text-ink-muted">{t("results.pinched")}</span>
        </div>
        <div className="flex min-w-[118px] flex-col items-center rounded-tile bg-night px-4 py-2.5 text-white pop-sm">
          <span className="font-display text-[44px] leading-none font-extrabold text-lime tabular-nums">{shownSpots}</span>
          <span className="text-center text-[13px] font-extrabold text-white/70">{t("results.same_spots")}</span>
        </div>
      </div>
      {done?.ledgerStatus === "pending_review" ? (
        <p className="mt-1 rounded-tile bg-surface px-3 py-2 text-[14px] font-bold text-ink-2 pop-sm">
          {t("results.held")}
        </p>
      ) : null}
      {done && !done.paid ? (
        <p className="mt-1 text-[14px] font-bold text-ink-2">{t("results.xp_only")}</p>
      ) : null}
    </section>
  );

  const actions = done ? (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="flex flex-col gap-3"
    >
      <p className="flex items-center justify-center gap-2 text-[15px] font-extrabold text-success">
        <CheckCheck className="size-5" strokeWidth={3} aria-hidden />
        {t("results.collected_xp", { xp: done.xpGained })}
      </p>
      <Button
        variant="play"
        size="xl"
        block
        busy={start.isPending}
        onClick={() => start.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}
      >
        {start.isPending ? null : <PinchGlyph className="size-8" />}
        {t("results.play_again")}
      </Button>
      <Button variant="light" block asChild>
        <Link to="/">
          <House className="size-5" strokeWidth={2.5} aria-hidden />
          {t("results.go_today")}
        </Link>
      </Button>
    </m.div>
  ) : (
    <div className="flex flex-col gap-3">
      {collect.error instanceof ApiError && collect.error.code === "PACK_INCOMPLETE" ? (
        // A round never reached the server (e.g. an offline answer was refused): resume at the missing one.
        <div className="pop-sm flex items-center gap-3 rounded-tile bg-marigold-soft p-3">
          <p className="flex-1 text-[15px] font-semibold text-ink">{t("results.incomplete")}</p>
          <Button size="sm" variant="primary" asChild>
            <Link to={`/play/${packId}`}>{t("results.finish_pack")}</Link>
          </Button>
        </div>
      ) : collect.error ? (
        <InlineError error={collect.error} onRetry={() => collect.mutate()} />
      ) : null}
      {waiting ? (
        <p role="status" className="rounded-tile bg-surface-2 p-3 text-center font-bold text-ink-2 pop-sm">
          {tn("sync.waiting", waiting)}
        </p>
      ) : null}
      <Button
        variant="play"
        size="xl"
        block
        busy={collect.isPending}
        disabled={waiting > 0}
        onClick={() => collect.mutate()}
      >
        {collect.isPending ? null : <CheckCheck className="size-7" strokeWidth={2.5} aria-hidden />}
        {collect.isPending ? t("results.collecting") : t("results.save_round")}
      </Button>
    </div>
  );

  const matches = pinches.length ? (
    <section aria-labelledby="matches" className="flex flex-col gap-3">
      <h2 id="matches" className="px-1 text-[21px] font-black">
        {t("results.matches")}
      </h2>
      <ul className={cn("grid gap-3", family === "desktop" ? "grid-cols-2" : "grid-cols-1")}>
        {pinches.map((r) => (
          <MatchRow key={r.promptId} r={r} />
        ))}
      </ul>
    </section>
  ) : rounds.length ? (
    <p className="pop-sm rounded-tile bg-surface p-4 text-[15px] text-ink-2">{t("results.empty")}</p>
  ) : null;

  return (
    <main className="min-h-dvh px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-10 sm:px-6 md:px-8 md:pt-8 lg:px-10 xl:px-12 xl:pt-10">
      {family === "phone" ? (
        <div className="mx-auto flex max-w-[560px] flex-col gap-5 pb-44">
          {score}
          {matches}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-surface bg-canvas px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-6">
            <div className="mx-auto max-w-[560px]">{actions}</div>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8">
          <div className="sticky top-8 flex flex-col gap-5 self-start">
            {score}
            {actions}
          </div>
          <div className="flex flex-col gap-5">{matches}</div>
        </div>
      )}
      <RewardQueue key={done ? "done" : "pending"} rewards={rewards} />
    </main>
  );
}

export default withMotion(Results);
