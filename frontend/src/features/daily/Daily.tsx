// /daily — Think Like India (docs/SCREENS.md §7, docs/GAME_DESIGN.md §10). Same 5 prompts for everyone
// today; one word each, graded against what India said. Phone: one prompt per screen. Tablet/desktop:
// all five visible as a row, the active one large. Ends with a shareable grid.
import { useMutation } from "@tanstack/react-query";
import { m } from "motion/react";
import { CalendarCheck, Copy, MessageCircleQuestion, Share2, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { api as contract, detectLang, normalize, type z } from "@shared";
import { DailyCard, Panel } from "@/components/cards";
import { InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { t, tk } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import { queryClient } from "@/lib/query";
import { useDaily } from "@/lib/queries";
import { useFamily } from "@/lib/use-family";
import { track } from "@/lib/events";
import { withMotion } from "@/components/motion-root";
import { PromptMedia } from "@/components/prompt-media";

type Daily = z.infer<typeof contract.Daily>;
type Grade = "top" | "top5" | "none";
const SQUARE: Record<Grade, string> = { top: "bg-success-bright", top5: "bg-marigold", none: "bg-surface-2" };

function Square({ grade, className }: { grade: Grade; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block rounded-[8px] border-[3px] border-surface", SQUARE[grade], className)}
    />
  );
}
const GRADE_TONE: Record<Grade, string> = {
  top: "bg-success-soft text-success",
  top5: "bg-marigold-soft text-marigold-ink",
  none: "bg-surface-2 text-ink-muted",
};

function timeToMidnightIst() {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const ms = (24 * 3600 - (ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds())) * 1000;
  return { h: Math.floor(ms / 3_600_000), m: Math.floor((ms % 3_600_000) / 60_000) };
}

function PromptTile({
  p,
  active,
  answered,
  onClick,
}: {
  p: Daily["prompts"][number];
  active: boolean;
  answered?: Daily["answers"][number];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active || undefined}
      className={cn(
        // Desktop: landscape tiles, so the strip is a compact row, not a wall of tall cards (D52).
        "relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-tile p-3 text-left transition-transform md:aspect-[4/3]",
        // Question prompts have no photo by design: a soft brand tile with an icon, so they never read as a
        // broken image (D53).
        active
          ? "bg-night text-white ring-4 pop ring-marigold"
          : p.asset
            ? "bg-surface text-ink pop-sm"
            : "bg-brand-soft text-brand-ink pop-sm",
        p.asset && "text-white",
      )}
    >
      {p.asset ? (
        <>
          <img
            src={p.asset.src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-night/30 to-night/85"
          />
        </>
      ) : null}
      {answered ? (
        <Square grade={answered.grade} className="mb-auto size-7 md:size-6" />
      ) : !p.asset ? (
        <span aria-hidden className={cn("mb-auto", active ? "text-marigold" : "text-brand")}>
          {p.textKey.includes("sound") ? (
            <Volume2 className="size-7 md:size-6" strokeWidth={2.5} />
          ) : (
            <MessageCircleQuestion className="size-7 md:size-6" strokeWidth={2.5} />
          )}
        </span>
      ) : null}
      <span className="line-clamp-3 text-lg leading-tight font-black md:line-clamp-2 md:text-[15px]">
        {tk(p.textKey)}
      </span>
    </button>
  );
}

function Grid({ daily }: { daily: Daily }) {
  const share = useMutation({ mutationFn: () => api(`/daily/${daily.day}/share`, { schema: "DailyShare" }) });
  const { h, m: min } = timeToMidnightIst();
  const doShare = async () => {
    const { text } = await share.mutateAsync();
    track("share", { what: "daily" });
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success(t("common.copied"));
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };
  const grades = Array.from(
    { length: 5 },
    (_, i) => daily.answers.find((a) => a.idx === i)?.grade ?? "none",
  ) as Grade[];
  return (
    <Panel className="flex flex-col gap-5 p-6">
      <div className="flex items-center gap-2" aria-label={grades.join(", ")}>
        {grades.map((g, i) => (
          <m.span
            key={i}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring.bouncy, delay: i * 0.08 }}
          >
            <Square grade={g} className="size-11" />
          </m.span>
        ))}
      </div>
      <p className="text-section font-black">
        {t("daily.done_title", { n: grades.filter((g) => g !== "none").length })}
      </p>
      <ul className="flex flex-col gap-2">
        {daily.answers.map((a) => (
          <li
            key={a.idx}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-2 border-line pb-2 font-semibold last:border-0"
          >
            <span
              className={cn(
                "rounded-full border-2 border-surface px-2.5 py-0.5 text-sm font-extrabold",
                GRADE_TONE[a.grade],
              )}
            >
              {t(`daily.grade.${a.grade}`)}
            </span>
            <span className="text-ink">{t("daily.you_said", { word: a.word })}</span>
            {a.india ? (
              <span className="text-ink-muted">
                {t("daily.india_said", { word: a.india.text })} ({a.india.pct}%)
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Button busy={share.isPending} onClick={doShare}>
          {"share" in navigator ? (
            <Share2 className="size-5" aria-hidden />
          ) : (
            <Copy className="size-5" aria-hidden />
          )}
          {t("daily.share")}
        </Button>
        <p className="text-ink-muted">{t("daily.next_in", { h, m: min })}</p>
      </div>
    </Panel>
  );
}

/** Desktop side panel (D55): today's grid as you fill it, what the colours mean, and when a new set lands. */
function TodayGrid({ daily }: { daily: Daily }) {
  const answered = new Map(daily.answers.map((a) => [a.idx, a]));
  const tops = daily.answers.filter((a) => a.grade === "top").length;
  const { h, m: min } = timeToMidnightIst();
  return (
    <aside className="sticky top-8 flex flex-col gap-4 self-start rounded-card bg-surface p-5 pop-sm">
      <p className="font-display text-[20px] font-black text-ink">{t("daily.done_title", { n: tops })}</p>
      <div className="grid grid-cols-5 gap-1.5">
        {daily.prompts.map((p, i) => {
          const a = answered.get(i);
          return a ? (
            <Square key={p.promptId} grade={a.grade} className="aspect-square w-full" />
          ) : (
            <span
              key={p.promptId}
              aria-hidden
              className="block aspect-square w-full rounded-[8px] border-[3px] border-dashed border-line"
            />
          );
        })}
      </div>
      <ul className="flex flex-col gap-2 border-t-2 border-line pt-4">
        {(["top", "top5", "none"] as const).map((g) => (
          <li key={g} className="flex items-center gap-2.5 text-[14px] font-semibold text-ink-2">
            <Square grade={g} className="size-5 shrink-0" />
            {t(`daily.grade.${g}`)}
          </li>
        ))}
      </ul>
      <p className="border-t-2 border-line pt-4 text-[14px] font-semibold text-ink-muted">
        {t("daily.next_in", { h, m: min })}
      </p>
    </aside>
  );
}

function DailyPage() {
  const family = useFamily();
  const daily = useDaily();
  const [active, setActive] = useState<number | null>(null);
  const [word, setWord] = useState("");
  const [last, setLast] = useState<{ grade: Grade; india: { text: string; pct: number } | null } | null>(
    null,
  );

  const answer = useMutation({
    mutationFn: (v: { idx: number; text: string }) =>
      api(`/daily/${daily.data!.day}/answers`, {
        method: "POST",
        body: { idx: v.idx, word: { text: v.text, lang: detectLang(normalize(v.text), "en") } },
        schema: "DailyAnswerResult",
      }),
    onSuccess: (res) => {
      if ((daily.data?.answers.length ?? 0) + 1 >= 5) track("daily_done");
      setLast(res);
      setWord("");
      void queryClient.invalidateQueries({ queryKey: ["daily"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (daily.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }
  if (daily.error) {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <InlineError error={daily.error} onRetry={() => daily.refetch()} />
      </div>
    );
  }

  const d = daily.data;
  const answered = new Map(d.answers.map((a) => [a.idx, a]));
  const nextOpen = d.prompts.findIndex((_, i) => !answered.has(i));
  const idx = active ?? (nextOpen === -1 ? 0 : nextOpen);
  const finished = d.answers.length >= 5;
  const current = d.prompts[idx]!;
  const currentAnswer = answered.get(idx);

  const header = (
    <DailyCard
      icon={<CalendarCheck className="size-7" strokeWidth={1.75} />}
      title={t("daily.title", { n: d.number })}
      sub={t("daily.sub")}
    />
  );

  const stage = currentAnswer ? (
    <Panel className="flex flex-col gap-3 p-5">
      <p className="text-[30px] leading-tight font-black">{tk(current.textKey)}</p>
      <p className={cn("w-fit rounded-full px-3 py-1 font-semibold", GRADE_TONE[currentAnswer.grade])}>
        {t(`daily.grade.${currentAnswer.grade}`)}
      </p>
      <p className="text-[17px] text-ink-2">{t("daily.you_said", { word: currentAnswer.word })}</p>
      {currentAnswer.india ? (
        <p className="text-[17px] text-ink-muted">
          {t("daily.india_said", { word: currentAnswer.india.text })} ({currentAnswer.india.pct}%)
        </p>
      ) : null}
    </Panel>
  ) : (
    <form
      className="flex flex-col gap-3 rounded-card bg-surface p-4 pop md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (word.trim()) answer.mutate({ idx, text: word.trim() });
      }}
    >
      <p className="text-[14px] font-extrabold text-ink-muted">{t("daily.prompt_n", { n: idx + 1 })}</p>
      {current.asset ? (
        <PromptMedia
          round={current}
          className="aspect-[4/3] w-full md:aspect-[4/3] md:max-w-[620px] short:aspect-[16/10]"
        />
      ) : null}
      <p className="text-[clamp(30px,6vw,48px)] leading-[1.05] font-black text-balance md:text-[34px]">
        {tk(current.textKey)}
      </p>
      {last ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("rounded-full px-3 py-1 font-semibold", GRADE_TONE[last.grade])}>
            {t(`daily.grade.${last.grade}`)}
          </span>
          {last.india ? (
            <span className="text-ink-muted">{t("daily.india_said", { word: last.india.text })}</span>
          ) : null}
        </div>
      ) : null}
      {/* Phone: stacked. Wider: the word and its button on one row, not a bar spanning the card (D51). */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value.slice(0, 40))}
          placeholder={t("daily.placeholder")}
          aria-label={t("daily.placeholder")}
          autoCapitalize="none"
          autoComplete="off"
          className="h-14 min-w-0 rounded-full bg-surface px-6 text-[19px] font-bold pop placeholder:font-semibold placeholder:text-ink-muted focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none md:flex-1"
        />
        <Button
          type="submit"
          variant="play"
          disabled={!word.trim()}
          busy={answer.isPending}
          className="w-full md:h-14 md:w-auto md:min-w-[200px] lg:h-14 xl:h-14"
        >
          {answer.isPending ? t("daily.locking") : t("daily.lock")}
        </Button>
      </div>
      {answer.error ? <InlineError error={answer.error} /> : null}
    </form>
  );

  const body = (
    <div className="flex min-w-0 flex-col gap-4 md:gap-5">
      {header}
      {family !== "phone" ? (
        <div className="grid grid-cols-5 gap-3">
          {d.prompts.map((p, i) => (
            <PromptTile
              key={p.promptId}
              p={p}
              active={!finished && i === idx}
              answered={answered.get(i)}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      ) : (
        <ol className="grid grid-cols-5 gap-1.5" aria-label={t("daily.prompt_n", { n: idx + 1 })}>
          {d.prompts.map((p, i) => (
            <li key={p.promptId} className="flex">
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "h-3.5 w-full cursor-pointer rounded-full border-2 border-surface",
                  answered.has(i) ? "bg-success-bright" : i === idx ? "bg-marigold" : "bg-surface",
                )}
                aria-label={t("daily.prompt_n", { n: i + 1 })}
              />
            </li>
          ))}
        </ol>
      )}
      {finished ? <Grid daily={d} /> : stage}
    </div>
  );

  // Desktop: the challenge plus a side panel, instead of one column with the screen's right half empty.
  return family === "desktop" ? (
    <div className="mx-auto grid w-full max-w-[1100px] grid-cols-[minmax(0,1fr)_280px] items-start gap-6">
      <h1 className="sr-only">{t("daily.title", { n: d.number })}</h1>
      {body}
      <TodayGrid daily={d} />
    </div>
  ) : (
    <div className="mx-auto flex w-full max-w-[880px] flex-col pt-[env(safe-area-inset-top)]">
      <h1 className="sr-only">{t("daily.title", { n: d.number })}</h1>
      {body}
    </div>
  );
}

export default withMotion(DailyPage);
