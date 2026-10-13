// Money, numbers and dates for India (docs/CONTENT_I18N.md §5). ₹ before the number, two decimals.
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 340 → "₹3.40"; 640000 → "₹6,400" (no paise once it's big). */
export const rupees = (paise: number) => (Math.abs(paise) >= 100_000 ? inrWhole : inr).format(paise / 100);

/** Signed amount for ledger rows: "+₹3.40" / "−₹50.00". */
export const signedRupees = (paise: number) => `${paise < 0 ? "−" : "+"}${rupees(Math.abs(paise))}`;

export const number = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** "Tuesday, 13 October" */
export const longDate = (d: Date, lang = "en") =>
  new Intl.DateTimeFormat(`${lang}-IN`, { weekday: "long", day: "numeric", month: "long" }).format(d);

export const dayNumber = (iso: string) => new Date(iso).getDate();
export const monthShort = (iso: string, lang = "en") =>
  new Intl.DateTimeFormat(`${lang}-IN`, { month: "short" }).format(new Date(iso));
export const time = (iso: string, lang = "en") =>
  new Intl.DateTimeFormat(`${lang}-IN`, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Calendar-day bucket label for timelines. */
export function dayBucket(iso: string, now = new Date()): "today" | "yesterday" | "earlier" {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = (start(now) - start(d)) / 86_400_000;
  return diff === 0 ? "today" : diff === 1 ? "yesterday" : "earlier";
}
