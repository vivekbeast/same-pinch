// / — Home (docs/UI_DIRECTION.md v3 §3–4). The next shared round comes first, with the giant PLAY; then
// shared moments (today's challenge, people you've matched). Money, XP and streaks live in Rewards and Me.
import { CalendarCheck, ChevronRight, HeartHandshake, UserRound } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router";
import { PinchGlyph } from "@/components/brand";
import { errorText } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { WordBubble } from "@/components/words";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { onIdle } from "@/lib/idle";
import { prefs } from "@/lib/prefs";
import { RecentPeople } from "@/components/people";
import { Avatar } from "@/components/plates";
import { cn } from "@/lib/cn";
import { useDaily, usePeople } from "@/lib/queries";
import { useMe } from "@/lib/session";
import { usePackStarter } from "@/lib/start-pack";
import { toast } from "@/lib/toast";
import { tourPending } from "@/lib/tour";

const Tour = lazy(() => import("@/features/onboarding/Tour"));

/** Top bar: just you (→ Me). Account numbers stay off the primary screen. */
function Hud({ handle }: { handle: string }) {
  return (
    <header className="flex items-center gap-2 pt-[env(safe-area-inset-top)]">
      <Link
        to="/me"
        className="ml-auto flex min-h-11 items-center gap-2 rounded-full px-3 text-ink-muted hover:bg-surface"
        aria-label={t("home.profile", { handle })}
      >
        <UserRound className="size-5" strokeWidth={2.5} aria-hidden />
        <span className="max-w-28 truncate text-[14px] font-extrabold">{handle}</span>
      </Link>
    </header>
  );
}

/** The hero: what the game is in one look, and the biggest button in the app. */
function PlayHero() {
  const start = usePackStarter();
  return (
    <section className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-card bg-brand px-4 pt-6 pb-6 text-center text-white pop md:px-6 md:pt-8 md:pb-8 xl:h-full xl:min-h-[360px] xl:gap-4 xl:px-8 xl:py-9 short:gap-2 short:pt-4">
      <div className="flex items-end justify-center gap-1" aria-hidden>
        <WordBubble word="chai" lang="en" state="matched" size="sm" className="mb-3 tilt-l" />
        <WordBubble word="चाय" lang="hi" state="matched" size="sm" side="right" className="mb-6 tilt-r" />
      </div>
      <p className="tilt-l rounded-full bg-lime px-3 py-1 text-[14px] font-black text-ink">
        {t("home.next_round")}
      </p>
      <h1 className="max-w-[16ch] text-[30px] leading-[1.02] font-extrabold text-balance md:text-[38px] xl:text-[44px]">
        {t("home.hero_title")}
      </h1>
      <p className="max-w-[28ch] text-[16px] font-bold text-white/80">{t("home.hero_sub")}</p>
      {/* The jiggle lives on a wrapper so it never fights the button's press squish. */}
      <span className="block w-full max-w-[360px] animate-jiggle [--tilt:-1.5deg]">
        <Button
          variant="play"
          size="xl"
          block
          data-tour="play-hero"
          busy={start.isPending}
          onClick={() => start.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}
        >
          {start.isPending ? null : <PinchGlyph className="size-8" />}
          {t("nav.play")}
        </Button>
      </span>
    </section>
  );
}

function DailyTile() {
  const daily = useDaily();
  if (daily.isPending) return <Skeleton className="h-[148px] rounded-card" />;
  const d = daily.data;
  const answered = d?.answers.length ?? 0;
  const done = answered >= 5;
  return (
    <Link
      to="/daily"
      data-tour="daily"
      className="relative flex min-h-[148px] press flex-col justify-between gap-2 overflow-hidden rounded-card bg-bubble p-4 text-ink pop [--lip:var(--color-bubble-600)] xl:min-h-0 xl:flex-1 xl:p-5"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="grid size-11 tilt-l place-items-center rounded-icon bg-surface text-ink pop-sm">
          <CalendarCheck className="size-6" strokeWidth={2.5} aria-hidden />
        </span>
        {/* Today's five prompts at a glance: filled = answered. */}
        <span aria-hidden className="hidden gap-1.5 md:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-4 rounded-[5px] border-2 border-ink/20",
                i < answered ? "bg-lime" : "bg-surface/60",
              )}
            />
          ))}
        </span>
      </span>
      <span>
        <span className="block font-display text-[20px] leading-tight font-extrabold">
          {d ? t("daily.card_title", { n: d.number }) : t("nav.daily")}
        </span>
        <span className="flex items-center gap-1 text-[14px] font-black text-ink/75">
          {done ? t("daily.card_done") : t("daily.card_cta")}
          <ChevronRight className="size-4" strokeWidth={3} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

/** The people you've matched, as a stack of faces — the tile is about them. */
function PeopleTile() {
  const people = usePeople().data?.people ?? [];
  return (
    <Link
      to="/people"
      className="flex min-h-[148px] press flex-col justify-between gap-2 rounded-card bg-night p-4 text-white pop xl:min-h-0 xl:flex-1 xl:p-5"
    >
      <span className="flex items-start justify-between gap-3">
        <HeartHandshake className="size-8 text-bubble" strokeWidth={2.5} aria-hidden />
        {people.length ? (
          <span aria-hidden className="hidden -space-x-3 md:flex">
            {people.slice(0, 4).map((p) => (
              <Avatar
                key={p.handle}
                handle={p.handle}
                avatar={p.avatar}
                size={40}
                className="ring-[3px] ring-night"
              />
            ))}
          </span>
        ) : null}
      </span>
      <span>
        <span className="block font-display text-[20px] leading-tight font-extrabold">
          {t("home.find_people")}
        </span>
        <span className="flex items-center gap-1 text-[14px] font-black text-white/70">
          {t("home.find_people_cta")} <ChevronRight className="size-4" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

function SharedMoments() {
  return (
    <section className="flex flex-col gap-3 xl:h-full" aria-labelledby="shared-moments">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="shared-moments" className="text-[22px] font-black text-ink">
            {t("home.shared_title")}
          </h2>
          <p className="text-[14px] font-bold text-ink-muted">{t("home.shared_sub")}</p>
        </div>
        <HeartHandshake className="size-7 shrink-0 text-brand xl:hidden" strokeWidth={2.5} aria-hidden />
      </div>
      {/* One tile each: today's shared words (Daily) and the people you've matched. */}
      {/* Phone/tablet: side by side. Desktop: stacked in the right column of the bento. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 lg:gap-5 xl:flex xl:flex-1 xl:flex-col xl:gap-4">
        <DailyTile />
        <PeopleTile />
      </div>
    </section>
  );
}

/** Keep two unplayed packs on the phone (docs/ARCHITECTURE.md §4), quietly, when idle and online. */
function usePrefetchPacks() {
  useEffect(() => {
    if (!navigator.onLine) return;
    // At most every 10 minutes (D44): Home re-mounts on every tab switch; the server doesn't need to hear it.
    const KEY = "sp.prefetchAt";
    try {
      if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < 10 * 60_000) return;
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* storage blocked: prefetch anyway */
    }
    const run = async () => {
      const offline = await import("@/lib/offline");
      const small = prefs().dataSaver;
      for (let i = 0; i < 2; i++) {
        const ready = (await offline.storedPacks()).length;
        if (ready >= 2 || !navigator.onLine) break;
        try {
          const pack = await api("/packs", { method: "POST", schema: "Pack" });
          if ((await offline.getStoredPack(pack.packId)) !== null) break; // server handed back an open pack we have
          await offline.storePack(pack);
        } catch {
          break;
        }
      }
      // Every start: make sure stored packs' photos are cached (cheap when they already are).
      for (const { pack } of await offline.storedPacks()) await offline.warmAssets(pack, small);
    };
    return onIdle(() => void run(), 2000);
  }, []);
}

export default function Today() {
  const me = useMe().data!;
  usePrefetchPacks();
  return (
    // Phone: one column that fits a screen. Desktop: a bento — the PLAY hero takes 7 of 12 columns, shared
    // moments stack in the remaining 5 (D41). Content-sized, not viewport-sized: on a tall monitor the tiles
    // used to stretch into empty slabs (D51). Tall screens centre the block instead of leaving it at the top.
    <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 content-start gap-4 sm:gap-4 md:gap-5 lg:gap-5 xl:min-h-[calc(100dvh-112px)] xl:grid-cols-12 xl:content-center xl:gap-5 short:gap-3">
      {/* Desktop: the rail already has Me; a row just for your name was dead height (D52). */}
      <div className="xl:hidden">
        <Hud handle={me.handle} />
      </div>
      <div className="xl:col-span-7">
        <PlayHero />
      </div>
      <div className="xl:col-span-5">
        <SharedMoments />
      </div>
      {/* Desktop: the people behind those moments, so the screen isn't half empty (D55). */}
      <RecentPeople className="hidden xl:col-span-12 xl:flex" />
      {tourPending() ? (
        <Suspense fallback={null}>
          <Tour />
        </Suspense>
      ) : null}
    </div>
  );
}
