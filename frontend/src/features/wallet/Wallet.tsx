// /wallet (docs/SCREENS.md §9–10). Earned / pending / paid tiles, ledger as ticket stubs grouped by day,
// payouts, and "Send to UPI" — gated on a linked Google account (stage 3, docs/DECISIONS.md D27).
// Phone/tablet: segmented Earnings | Payouts. Desktop: both side by side, no segmented control.
import { useMutation } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleCheck,
  Hourglass,
  ReceiptIndianRupee,
  ShieldCheck,
  Ticket as TicketIcon,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { api as contract, UPI_RE, type z } from "@shared";
import { IconTile, NightCard, Panel, StatTile, Ticket } from "@/components/cards";
import { Page, PageHeader } from "@/components/page";
import { EmptyState, errorText, InlineError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/spinner";
import { api, googleStartUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dayBucket, dayNumber, monthShort, rupees, signedRupees, time } from "@/lib/format";
import { currentLang, t } from "@/lib/i18n";
import { queryClient } from "@/lib/query";
import { track } from "@/lib/events";
import { useLedger, usePayouts, useWallet } from "@/lib/queries";
import { useConfig, useMe } from "@/lib/session";
import { useFamily } from "@/lib/use-family";

type LedgerItem = z.infer<typeof contract.LedgerItem>;

function rowTitle(i: LedgerItem) {
  if (i.kind === "earn")
    return i.pinches != null ? t("wallet.row.earn", { n: i.pinches }) : t("wallet.row.earn_plain");
  return t(`wallet.row.${i.kind}`);
}

const STATUS_TONE: Record<LedgerItem["status"], string> = {
  credited: "text-success",
  paid: "text-success",
  pending: "text-marigold-ink",
  pending_review: "text-marigold-ink",
  failed: "text-danger",
};

/** Ledger grouped by calendar day, with the big day number + small month (reference timeline). */
function Timeline() {
  const ledger = useLedger();
  const lang = currentLang();
  if (ledger.isPending) return <Skeleton className="h-64 rounded-card" />;
  if (ledger.error) return <InlineError error={ledger.error} onRetry={() => ledger.refetch()} />;
  const items = ledger.data.pages.flatMap((p) => p.items);
  if (!items.length) return <EmptyState icon={TicketIcon} line={t("wallet.empty")} />;

  // One group per calendar day (items arrive newest first; a day may interleave earnings and payouts).
  const byDay = new Map<string, { key: string; iso: string; items: LedgerItem[] }>();
  for (const it of items) {
    const key = new Date(it.createdAt).toDateString();
    const g = byDay.get(key);
    if (g) g.items.push(it);
    else byDay.set(key, { key, iso: it.createdAt, items: [it] });
  }
  const groups = [...byDay.values()].sort((a, b) => b.iso.localeCompare(a.iso));
  for (const g of groups) g.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const bucket = dayBucket(g.iso);
        return (
          <section key={g.key} className="grid grid-cols-[52px_1fr] gap-x-3">
            <div className="flex flex-col items-center pt-2">
              <span className="text-[34px] leading-none font-bold text-ink">{dayNumber(g.iso)}</span>
              <span className="text-xs font-semibold tracking-wider text-brand uppercase">
                {monthShort(g.iso, lang)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              {bucket !== "earlier" ? (
                <p className="text-[15px] font-semibold text-ink-muted">{t(`wallet.${bucket}`)}</p>
              ) : null}
              {g.items.map((i) => (
                <Ticket key={i.id}>
                  <IconTile
                    tone={i.kind === "payout" ? "night" : i.status === "pending_review" ? "marigold" : "soft"}
                    className="size-11 md:size-10"
                  >
                    {i.kind === "payout" ? (
                      <ArrowUpRight strokeWidth={1.75} />
                    ) : (
                      <TicketIcon strokeWidth={1.75} />
                    )}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-medium text-ink">{rowTitle(i)}</p>
                    <p className={cn("text-[15px]", STATUS_TONE[i.status])}>
                      {t(`wallet.status.${i.status}`)}
                      <span className="text-ink-muted"> {time(i.createdAt, lang)}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-2xl font-bold md:text-xl",
                      i.amountPaise < 0 ? "text-ink" : "text-success",
                    )}
                  >
                    {signedRupees(i.amountPaise)}
                  </span>
                </Ticket>
              ))}
            </div>
          </section>
        );
      })}
      {ledger.hasNextPage ? (
        <Button
          variant="soft"
          busy={ledger.isFetchingNextPage}
          onClick={() => ledger.fetchNextPage()}
          className="self-start"
        >
          {t("wallet.more")}
        </Button>
      ) : null}
    </div>
  );
}

function PayoutList() {
  const payouts = usePayouts();
  const lang = currentLang();
  if (payouts.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (payouts.error) return <InlineError error={payouts.error} onRetry={() => payouts.refetch()} />;
  if (!payouts.data.items.length)
    return <EmptyState icon={ReceiptIndianRupee} line={t("wallet.empty_payouts")} />;
  return (
    <div className="flex flex-col gap-2">
      {payouts.data.items.map((p) => (
        <Ticket key={p.id}>
          <IconTile
            tone={p.status === "paid" ? "success" : p.status === "failed" ? "danger" : "marigold"}
            className="size-11"
          >
            {p.status === "paid" ? (
              <CircleCheck strokeWidth={1.75} />
            ) : p.status === "failed" ? (
              <TriangleAlert strokeWidth={1.75} />
            ) : (
              <Hourglass strokeWidth={1.75} />
            )}
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-medium text-ink">{p.upiMasked}</p>
            <p
              className={cn(
                "text-[15px]",
                p.status === "paid"
                  ? "text-success"
                  : p.status === "failed"
                    ? "text-danger"
                    : "text-marigold-ink",
              )}
            >
              {t(`wallet.status.${p.status}`)}
              <span className="text-ink-muted"> {time(p.createdAt, lang)}</span>
            </p>
          </div>
          <span className="shrink-0 text-2xl font-bold text-ink">{rupees(p.amountPaise)}</span>
        </Ticket>
      ))}
    </div>
  );
}

function PayoutSheet({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  balance: number;
}) {
  const [upi, setUpi] = useState("");
  const [amount, setAmount] = useState(() => (balance >= 5000 ? String(Math.floor(balance / 100)) : "50"));
  const paise = Math.round(Number(amount) * 100);
  const upiOk = UPI_RE.test(upi.trim());
  const send = useMutation({
    mutationFn: () =>
      api("/wallet/payouts", {
        method: "POST",
        body: { amountPaise: paise, upi: upi.trim() },
        schema: "PayoutCreated",
      }),
    onSuccess: () => {
      track("payout_request");
      for (const k of [["wallet"], ["ledger"], ["payouts"], ["me"]])
        void queryClient.invalidateQueries({ queryKey: k });
      onOpenChange(false);
    },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("payout.title")} description={t("payout.demo")}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <div className="flex flex-wrap gap-2 text-[15px]">
          {[t("payout.available", { amount: rupees(balance) }), t("payout.fee"), t("payout.wait")].map(
            (s) => (
              <span key={s} className="rounded-full bg-surface-2 px-3 py-1.5 font-medium text-ink-2">
                {s}
              </span>
            ),
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ink-2">{t("payout.upi")}</span>
          <input
            value={upi}
            onChange={(e) => setUpi(e.target.value)}
            placeholder={t("payout.upi_hint")}
            autoCapitalize="none"
            autoComplete="off"
            inputMode="email"
            className="h-14 rounded-tile bg-surface-2 px-5 text-[18px] focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ink-2">{t("payout.amount")}</span>
          <span className="flex h-14 items-center gap-2 rounded-tile bg-surface-2 px-5 focus-within:ring-4 focus-within:ring-brand/30">
            <span className="text-2xl font-bold text-ink-muted">₹</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              inputMode="numeric"
              aria-describedby="min"
              className="w-full bg-transparent text-2xl font-bold outline-none"
            />
          </span>
          <span id="min" className="text-[15px] text-ink-muted">
            {t("payout.min")}
          </span>
        </label>
        {send.error ? <p className="text-danger">{errorText(send.error)}</p> : null}
        <Button
          type="submit"
          block
          disabled={!upiOk || paise < 5000 || paise > balance}
          busy={send.isPending}
        >
          {send.isPending ? t("payout.sending") : t("payout.cta", { amount: rupees(paise || 0) })}
        </Button>
      </form>
    </Sheet>
  );
}

export default function Wallet() {
  const family = useFamily();
  const wallet = useWallet();
  const me = useMe().data!;
  const config = useConfig().data;
  const [tab, setTab] = useState<"earnings" | "payouts">("earnings");
  const [sending, setSending] = useState(false);
  const needsIdentity = me.payout.needs.includes("identity");

  const tiles = wallet.data ? (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      <StatTile value={rupees(wallet.data.balancePaise)} label={t("wallet.balance")} tone="reward" />
      <StatTile value={rupees(wallet.data.pendingPaise)} label={t("wallet.pending")} />
      <StatTile value={rupees(wallet.data.paidPaise)} label={t("wallet.paid")} tone="success" />
    </div>
  ) : (
    <Skeleton className="h-28 rounded-tile" />
  );

  const sendCta = needsIdentity ? (
    <Panel className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
      <IconTile>
        <ShieldCheck strokeWidth={1.75} />
      </IconTile>
      <p className="flex-1 text-ink-2">{t("wallet.needs_identity")}</p>
      {config?.linking.google ? (
        <Button variant="soft" size="md" asChild>
          <a href={googleStartUrl("link", "/me/wallet")}>{t("wallet.link_google")}</a>
        </Button>
      ) : null}
    </Panel>
  ) : (
    // Desktop: a normal-sized button in the header, not a bar across the whole page (D51).
    <div className={cn("flex flex-col gap-2", family === "desktop" && "items-end")}>
      <Button
        size={family === "desktop" ? "md" : undefined}
        onClick={() => setSending(true)}
        disabled={!wallet.data || wallet.data.balancePaise < 5000 || !me.payout.eligible}
      >
        <ArrowUpRight className="size-5" aria-hidden />
        {t("wallet.send")}
      </Button>
      {wallet.data && wallet.data.balancePaise < 5000 ? (
        <p className={cn("text-[15px] text-ink-muted", family === "desktop" ? "text-right" : "text-center")}>{t("errors.MIN_PAYOUT")}</p>
      ) : null}
    </div>
  );
  const sendInHeader = family === "desktop" && !needsIdentity;

  const howPay = wallet.data ? (
    <NightCard
      title={t("wallet.how_title")}
      sub={t("wallet.how_body", {
        base: rupees(wallet.data.howPay.basePaise),
        bonus: rupees(wallet.data.howPay.bhashaPaise),
        mult: wallet.data.howPay.multiplier,
      })}
    />
  ) : null;

  return (
    <Page wide={family === "desktop"}>
      <PageHeader
        back
        title={t("wallet.title")}
        sub={config?.demoMode ? t("common.demo_money") : undefined}
        actions={sendInHeader ? sendCta : undefined}
      />
      {wallet.error ? <InlineError error={wallet.error} onRetry={() => wallet.refetch()} /> : null}
      {tiles}
      {sendInHeader ? null : sendCta}
      {family === "desktop" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-section font-bold">{t("wallet.earnings")}</h2>
            <Timeline />
          </section>
          {/* Pinned while the long earnings list scrolls past. */}
          <section className="sticky top-8 flex flex-col gap-3">
            <h2 className="px-1 text-section font-bold">{t("wallet.payouts")}</h2>
            <PayoutList />
            {howPay}
          </section>
        </div>
      ) : (
        <>
          <Segmented
            label={t("wallet.title")}
            value={tab}
            onChange={setTab}
            items={[
              { value: "earnings", label: t("wallet.earnings") },
              { value: "payouts", label: t("wallet.payouts") },
            ]}
          />
          {tab === "earnings" ? <Timeline /> : <PayoutList />}
          {howPay}
        </>
      )}
      {wallet.data ? (
        <PayoutSheet
          key={String(sending)}
          open={sending}
          onOpenChange={setSending}
          balance={wallet.data.balancePaise}
        />
      ) : null}
    </Page>
  );
}
