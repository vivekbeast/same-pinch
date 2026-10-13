# COMPONENTS.md — inventory and how each is built

**Approach:** shadcn/ui is a *generator*, not a dependency. We run `npx shadcn@latest add <x>`, which copies Radix-based source into `src/components/ui/`, then we **rewrite the classes** against our tokens (DESIGN_SYSTEM.md). Patterns from Kibo UI / 21st.dev / Magic UI are used as *reference* only — read, understand, rebuild in our tokens. Nothing ships with a library's default look.

All variants use `cva`; merging via:

```ts
// src/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
```

> Tailwind v4 note: `twMerge` must know custom tokens so `rounded-card` and `rounded-full` don't both survive. Configure `extendTailwindMerge({ extend: { theme: { radius: ["card","tile","icon","plate"], shadow: ["card","float","night"] } } })`.

---

## Inventory

| Component | Source | Reference screen | Notes |
|---|---|---|---|
| `Button` | shadcn → rewritten | White pill "Next", violet "Confirm all 3" | variants below |
| `IconButton` | custom | Round white settings / cloud | 48 px circle, shadow-card |
| `Card` | custom | White rounded cards | `rounded-card bg-surface shadow-card` |
| `NightCard` | custom | "Item needs attention", "Check what we read", "Air-Gapped Vault" | slots: numeral, title, sub, chips, action |
| `GradientCard` | custom | Ride AI promo card | Used **once** (Daily card); big circle via `::after` |
| `GlassCard` | custom | Onboarding notification / vehicle card | `backdrop-blur-md` |
| `BhashaPlate` | custom | Indian number plate chip | signature |
| `StatTile` | custom | Overdue / Due soon / Missing | |
| `StatusTile` | custom | Insurance Valid / PUC Missing / RC Expired | |
| `IconTile` | custom | Tinted icon squares | soft / solid / danger |
| `ListRow` | custom | Settings & list rows | inset divider |
| `SectionHeader` | custom | "Needs attention 1 · See all" | |
| `SegmentedControl` | Radix Tabs (via shadcn `tabs`) | "Dues & papers / Reminders" | count badges |
| `FilterChips` | Radix ToggleGroup | "All vehicles / KA 03 IJ" | horizontal scroll, snap |
| `DayTimeline` | custom | Month-grouped dates | |
| `BottomNav` | custom | 5-tab nav + centre Add | Phone only |
| `NavRail` | custom | (adapted) | Tablet only |
| `Sidebar` / `ContextPanel` | custom | (adapted) | Desktop only, panel lazy |
| `ResponsiveSheet` | vaul + Radix Dialog | Add papers sheet | Sheet on phone, dialog on tablet/desktop |
| `Spinner` | custom | — | Buttons and small areas only |
| `Sheet` | `vaul` (shadcn `drawer`) | Add papers sheet, Ride AI download | grab handle |
| `Stepper` | custom | 1 Add · 2 Read · 3 Confirm | |
| `Switch` | Radix Switch (shadcn) | Violet toggles | restyled |
| `Progress` | Radix Progress | (level bar) | |
| `PageDots` | custom | Onboarding dots | animated width |
| `Toast` | `sonner` | — | themed |
| `FlipCard` | custom + Motion | — | game |
| `PinchStamp` | custom + Motion | — | game |
| `TimerRing` | custom SVG + Motion | — | game |
| `WordInput` | custom | Ride AI input | chips + mic |
| `IndiaMap` | custom SVG | — | regions as paths |
| `Skeleton` | custom | — | shape-matched |

---

## Button

```tsx
// src/components/ui/button.tsx
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-sans font-semibold " +
  "transition-[transform,background-color] active:scale-[0.98] " +
  "disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-float hover:bg-brand-600",
        light:   "bg-surface text-ink hover:bg-white/90",           // white pill on photos/night cards
        soft:    "bg-brand-soft text-brand-ink hover:bg-brand-soft/80", // "+ Add" pills
        ghost:   "bg-transparent text-brand hover:bg-brand-soft/60",   // "Not now", "See all"
        glass:   "bg-white/15 text-white backdrop-blur-md border border-white/15", // "Skip"
      },
      // Every size declares base + sm + md + lg + xl (RESPONSIVE.md R2)
      size: {
        lg: "h-14 sm:h-14 md:h-12 lg:h-12 xl:h-11 w-full sm:w-full md:w-auto lg:w-auto xl:w-auto " +
            "px-6 sm:px-6 md:px-8 lg:px-8 xl:px-7 text-[17px] sm:text-[17px] md:text-base lg:text-base xl:text-[15px]",
        md: "h-11 sm:h-11 md:h-11 lg:h-10 xl:h-10 px-5 sm:px-5 md:px-5 lg:px-5 xl:px-4 text-[15px] sm:text-[15px] md:text-[15px] lg:text-sm xl:text-sm",
        sm: "h-9 sm:h-9 md:h-9 lg:h-9 xl:h-8 px-4 sm:px-4 md:px-4 lg:px-4 xl:px-3 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
}
export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(button({ variant, size }), className)} {...props} />;
}
```

## BhashaPlate (signature)

Reborn from the Indian number plate: white body, ink border, coloured strip with the language code.

```tsx
// src/components/bhasha-plate.tsx
const strip = {
  en: "bg-lang-en", hi: "bg-lang-hi", kn: "bg-lang-kn",
  ta: "bg-lang-ta", te: "bg-lang-te", mr: "bg-lang-mr",
} as const;
type Lang = keyof typeof strip;

export function BhashaPlate({
  lang, word, state = "idle", onLangTap,
}: {
  lang: Lang; word: string;
  state?: "idle" | "matched" | "burnt" | "partner";
  onLangTap?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-stretch overflow-hidden rounded-plate border-[1.5px] bg-surface",
        state === "matched" && "border-pinch ring-4 ring-pinch/25",
        state === "burnt" && "border-line text-ink-faint line-through",
        state === "idle" && "border-ink",
        state === "partner" && "border-ink-2",
      )}
    >
      <button
        type="button"
        onClick={onLangTap}
        aria-label={`Language ${lang}`}
        className={cn("flex w-8 flex-col items-center justify-center text-[9px] font-bold tracking-wider text-white uppercase", strip[lang])}
      >
        <span aria-hidden className="mb-0.5 size-1.5 rounded-full border border-white/80" />
        {lang}
      </button>
      <span className="flex items-center px-3 font-display text-lg font-bold tracking-wide text-ink">
        {word}
      </span>
    </span>
  );
}
```

## NightCard

```tsx
export function NightCard({ numeral, numeralTone = "pinch", title, sub, children, action }: {
  numeral?: React.ReactNode; numeralTone?: "pinch" | "success";
  title: string; sub?: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section className="rounded-card bg-night p-6 text-white shadow-night">
      <div className="flex items-start gap-4">
        {numeral != null && (
          <span className={cn(
            "font-display text-[96px] leading-[0.85] font-bold tracking-tight",
            numeralTone === "pinch" ? "text-pinch" : "text-success-bright")}>
            {numeral}
          </span>
        )}
        <div className="pt-2">
          <h2 className="font-display text-[28px] leading-8 font-bold">{title}</h2>
          {sub && <p className="mt-1 text-white/65">{sub}</p>}
        </div>
      </div>
      {children && <div className="mt-5 flex flex-wrap gap-2">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </section>
  );
}

// tinted chip used inside NightCard
export const NightChip = ({ icon, children, tone = "pinch" }: {...}) => (
  <span className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 text-[15px] font-medium",
    tone === "pinch" ? "bg-pinch/15 text-white" : "bg-white/10 text-white")}>
    {icon}{children}
  </span>
);
```

## GradientCard

```tsx
export function GradientCard({ icon, title, sub, action, children }: {...}) {
  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-400 to-brand p-5 text-white shadow-float
                        after:absolute after:-top-16 after:-right-20 after:size-72 after:rounded-full after:bg-white/8 after:content-['']">
      <div className="relative z-10 flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-icon bg-white/15">{icon}</span>
        <div className="flex-1">
          <h3 className="font-display text-2xl font-bold">{title}</h3>
          <p className="text-white/80">{sub}</p>
        </div>
        {action /* <Button variant="light" size="sm"> */}
      </div>
      {children && <div className="relative z-10 mt-4 flex flex-col items-start gap-2">{children}</div>}
    </section>
  );
}
export const GlassPill = ({ children }) => (
  <span className="max-w-full truncate rounded-full bg-white/15 px-4 py-2 text-[15px]">“{children}”</span>
);
```

## GlassCard

```tsx
export const GlassCard = ({ className, ...p }) => (
  <div className={cn("rounded-card border border-white/10 bg-night-glass p-4 text-white backdrop-blur-md", className)} {...p} />
);
```
Performance: `backdrop-blur` is costly on low-end GPUs. Use it on at most one element per screen; with `data-saver` on or `prefers-reduced-transparency`, swap to solid `bg-night/85`.

## StatTile / StatusTile / IconTile

```tsx
export const StatTile = ({ value, label, icon, tone = "ink" }) => (
  <div className="rounded-tile bg-surface p-4 shadow-card">
    <div className="flex items-start justify-between">
      <span className={cn("font-display text-4xl font-bold",
        { ink: "text-ink", danger: "text-danger", brand: "text-brand", success: "text-success", reward: "text-marigold-ink" }[tone])}>{value}</span>
      <span className="text-ink-faint">{icon}</span>
    </div>
    <p className="mt-1 text-ink-muted">{label}</p>
  </div>
);

const statusTile = cva("rounded-tile p-3", {
  variants: { status: {
    synced:  "bg-success-soft [&_[data-v]]:text-success",
    missing: "bg-surface-2 [&_[data-v]]:text-ink-muted",
    new:     "bg-pinch-soft [&_[data-v]]:text-pinch-ink",
    expired: "bg-danger-soft [&_[data-v]]:text-danger",
  }},
});
export const StatusTile = ({ label, value, icon, status }) => (
  <div className={statusTile({ status })}>
    <p className="text-sm text-ink-muted">{label}</p>
    <p data-v className="mt-0.5 flex items-center gap-1.5 text-[17px] font-medium">{icon}{value}</p>
  </div>
);

const iconTile = cva("grid size-14 shrink-0 place-items-center rounded-icon [&_svg]:size-6", {
  variants: { tone: {
    soft: "bg-brand-soft text-brand", solid: "bg-gradient-to-br from-brand-400 to-brand text-white",
    danger: "bg-danger-soft text-danger", success: "bg-success-soft text-success", neutral: "bg-surface-2 text-ink-2",
  }},
  defaultVariants: { tone: "soft" },
});
```

## ListRow & SectionHeader

```tsx
export const ListRow = ({ icon, title, sub, trailing, onClick }) => (
  <button onClick={onClick}
    className="group flex w-full items-center gap-4 px-5 py-3 text-left active:bg-surface-2">
    {/* parent list: <div className="overflow-hidden rounded-card bg-surface shadow-card"> */}
    {icon}
    <span className="flex-1 border-b border-line py-1 group-last:border-0">
      <span className="block text-[17px] font-medium text-ink">{title}</span>
      {sub && <span className="block text-ink-muted">{sub}</span>}
    </span>
    {trailing ?? <ChevronRight className="size-5 text-ink-faint" />}
  </button>
);
```
Inset divider rule (from reference): the divider starts at the text, not under the icon. Implement by putting the border on the text column, as above.

```tsx
export const SectionHeader = ({ title, count, action }) => (
  <div className="mt-8 mb-3 flex items-end justify-between px-1">
    <h2 className="flex items-center gap-3 font-display text-[28px] font-bold text-ink">
      {title}
      {count != null && <span className="grid h-8 min-w-8 place-items-center rounded-full bg-surface-2 px-2 text-base text-ink-2">{count}</span>}
    </h2>
    {action}
  </div>
);
```

## SegmentedControl (Radix Tabs, restyled)

```tsx
<Tabs.Root defaultValue="earnings">
  <Tabs.List className="flex rounded-full bg-surface-2 p-1.5">
    {tabs.map(t => (
      <Tabs.Trigger key={t.value} value={t.value}
        className="relative flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-[16px] text-ink-muted
                   data-[state=active]:text-ink">
        {active === t.value && (
          <m.span layoutId="seg-pill" className="absolute inset-0 rounded-full bg-surface shadow-card"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }} />
        )}
        <span className="relative z-10 flex items-center gap-2">
          {t.icon}{t.label}
          {t.count ? <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold",
             t.alert ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-ink")}>{t.count}</span> : null}
        </span>
      </Tabs.Trigger>
    ))}
  </Tabs.List>
</Tabs.Root>
```
Radix gives keyboard arrows, roles and `aria-selected` for free.

## FilterChips (Radix ToggleGroup)
- Container: `flex gap-2 overflow-x-auto snap-x px-5 -mx-5 scrollbar-none`.
- Item: `h-11 px-5 rounded-full bg-surface shadow-card text-ink data-[state=on]:bg-brand data-[state=on]:text-white snap-start`.

## DayTimeline

```tsx
<div className="grid grid-cols-[56px_16px_1fr] gap-x-3">
  <div className="text-center">
    <div className="font-display text-4xl font-bold text-ink">13</div>
    <div className="text-xs font-semibold tracking-wider text-brand uppercase">Oct</div>
  </div>
  <div className="relative flex justify-center">
    <span className="mt-3 size-3.5 rounded-full border-[2.5px] border-brand bg-surface" />
    <span className="absolute top-7 bottom-0 w-px bg-line" />
  </div>
  <div>…rows…</div>
</div>
```

## BottomNav with Play FAB

```tsx
const tabs = [
  { to: "/", label: "Today", icon: House },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "play", label: "Play", icon: PinchGlyph, fab: true },
  { to: "/wallet", label: "Wallet", icon: WalletMinimal, badge: pendingCount },
  { to: "/pals", label: "Pals", icon: Users },
];

{/* Phone only (base–sm). Tablet uses NavRail, desktop uses Sidebar. */}
<nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex sm:flex md:hidden lg:hidden xl:hidden
                border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
  <ul className="mx-auto flex h-[72px] sm:h-[72px] w-full sm:w-full max-w-[480px] sm:max-w-[560px] items-center justify-around">
    {tabs.map(t => t.fab ? (
      <li key="play" className="flex flex-col items-center">
        <button onClick={openPlaySheet}
          className="grid h-12 w-[88px] place-items-center rounded-full bg-brand text-white shadow-float active:scale-95">
          <t.icon className="size-7" />
        </button>
        <span className="mt-1 text-[13px] font-semibold text-brand">Play</span>
      </li>
    ) : (
      <li key={t.to}>
        <NavLink to={t.to} className="group flex flex-col items-center">
          {({ isActive }) => (<>
            <span className={cn("relative grid h-9 w-16 place-items-center rounded-full",
                  isActive && "bg-brand-soft text-brand")}>
              <t.icon className="size-6" />
              {t.badge ? <span className="absolute -top-1 right-2 grid size-5 place-items-center rounded-full bg-danger text-[11px] font-bold text-white">{t.badge}</span> : null}
            </span>
            <span className={cn("mt-1 text-[13px]", isActive ? "font-semibold text-brand" : "text-ink-muted")}>{t.label}</span>
          </>)}
        </NavLink>
      </li>
    ))}
  </ul>
</nav>
```

No `backdrop-blur` on the nav (it repaints on every scroll frame on low-end GPUs); solid `bg-surface` instead.

## NavRail (tablet, md–lg)

```tsx
<nav aria-label="Main" className="sticky top-0 hidden sm:hidden md:flex lg:flex xl:hidden h-dvh
     w-0 sm:w-0 md:w-[88px] lg:w-[96px] xl:w-0 flex-col items-center gap-2 border-r border-line bg-surface py-6">
  <Logo className="mb-4" />
  <button onClick={openPlay} className="mb-4 flex h-14 md:h-14 lg:h-14 w-14 md:w-14 lg:w-16 items-center justify-center
          rounded-full bg-brand text-white shadow-float" aria-label="Play"><PinchGlyph className="size-7" /></button>
  {tabs.map(t => (
    <NavLink key={t.to} to={t.to} className="flex w-full flex-col items-center gap-1 py-2 text-[13px] text-ink-muted
             aria-[current=page]:text-brand aria-[current=page]:font-semibold">
      <span className="flex h-9 w-14 items-center justify-center rounded-full in-aria-[current=page]:bg-brand-soft"><t.icon className="size-6" /></span>
      {t.label}
    </NavLink>
  ))}
  <NavLink to="/settings" className="mt-auto …"><Settings className="size-6" /></NavLink>
</nav>
```

## Sidebar (desktop, xl+)

- `hidden xl:flex w-0 xl:w-[264px] 2xl:w-[288px] h-dvh sticky top-0 flex-col gap-1 border-r border-line bg-surface px-4 py-6`.
- Top: logo + wordmark. Then a full-width **Play** button (`Button variant="primary" size="md"` with "Play · 10 rounds").
- Nav items: `flex h-11 items-center gap-3 rounded-full px-4 text-[15px]`, active = `bg-brand-soft text-brand-ink font-semibold`, hover = `bg-surface-2`.
- Bottom: mini status card (`bg-night text-white rounded-tile p-4`): 🔥 7 in coral, ₹62.40 in marigold, level name; Settings link.

## ContextPanel (desktop, xl+, lazy)

`hidden xl:flex xl:w-[360px] 2xl:w-[400px] flex-col gap-4 py-8 pr-8` — holds the daily card, leaderboard top 5, wallet summary, or (on Play) pack progress. Lazy-loaded so phones never download it.

## ResponsiveSheet

One API, two renderings: phone → vaul bottom sheet; tablet/desktop → Radix Dialog centred.

```tsx
export function ResponsiveSheet({ open, onOpenChange, title, children }: Props) {
  const family = useFamily();
  if (family === "phone") {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-ink/40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 rounded-t-[32px] bg-surface px-5 sm:px-6 pt-3
                pb-[calc(24px+env(safe-area-inset-bottom))] max-h-[92dvh] sm:max-h-[92dvh]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-line" />
            <Drawer.Title className="font-display text-section font-bold">{title}</Drawer.Title>
            {children}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface shadow-night
              w-0 md:w-[560px] lg:w-[560px] xl:w-[560px] max-h-[85dvh] md:max-h-[85dvh] lg:max-h-[85dvh] xl:max-h-[80dvh]
              p-0 md:p-7 lg:p-7 xl:p-8 overflow-y-auto">
          <Dialog.Title className="font-display text-section font-bold">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

## Spinner & Skeleton

```tsx
export const Spinner = ({ className, label = "Loading" }) => (
  <span role="status" className={cn("inline-flex", className)}>
    <svg viewBox="0 0 24 24" className="size-5 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5" fill="none" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
    <span className="sr-only">{label}</span>
  </span>
);

export const Skeleton = ({ className }) => (
  <div aria-hidden className={cn(
    "rounded-tile bg-surface-2 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/.55),transparent)] bg-[length:200%_100%] animate-shimmer motion-reduce:animate-none",
    className)} />
);
```
Screen skeletons (`TodaySkeleton`, `PlaySkeleton`, …) are built from these and live next to their layouts, one per device family.

## Sheet (vaul) + Stepper

- `Drawer.Content`: `rounded-t-[32px] bg-surface px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom))]`.
- Handle: `mx-auto mb-5 h-1.5 w-12 rounded-full bg-line`.
- Overlay: `bg-ink/40`.
- First option row = dark hero: `rounded-[24px] bg-gradient-to-r from-night to-night-2 p-5 text-white shadow-night`, left 64 px violet circle icon.
- Secondary options: 2-col grid tiles `rounded-[24px] bg-surface-2 p-5`, white inner icon tile.

```tsx
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mt-6 flex items-start justify-between">
      {steps.map((s, i) => (
        <li key={s} className="relative flex flex-1 flex-col items-center">
          {i > 0 && <span className="absolute top-5 right-1/2 h-px w-full bg-line" />}
          <span className={cn("relative z-10 grid size-10 place-items-center rounded-full border text-base font-semibold",
            i === current ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2")}>{i + 1}</span>
          <span className={cn("mt-2 text-[15px]", i === current ? "font-semibold text-ink" : "text-ink-muted")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
```

## Switch (Radix, restyled)
Root: `h-7 w-12 rounded-full bg-line data-[state=checked]:bg-brand transition-colors`. Thumb: `size-6 rounded-full bg-white shadow translate-x-0.5 data-[state=checked]:translate-x-[22px] transition-transform`.

## PageDots
Inactive `size-2.5 rounded-full bg-white/40`; active animates `width` 10 → 32 px, `bg-white`. Use Motion `layout`.

## Game components (behaviour in MOTION.md)

- **FlipCard**: two faces with `backface-visibility: hidden` (`[backface-visibility:hidden]`), parent `[perspective:900px]`, Motion rotates `rotateY`.
- **PinchStamp**: absolute centre, `font-display text-6xl font-bold text-pinch -rotate-6 border-4 border-pinch rounded-2xl px-5 py-2 bg-surface/90`.
- **TimerRing**: SVG circle r=22, `stroke-dasharray`, Motion animates `pathLength` from 1 → 0 linear over duration; turns `stroke-pinch` at ≤ 5 s.
- **WordInput**: `h-14 rounded-full bg-surface shadow-card px-5`, `enterKeyHint="done"`, `autoCapitalize="none"`, `autoCorrect="off"`, `inputMode="text"`, `lang` attribute set from current UI language for better IME behaviour; mic button `size-11 rounded-full bg-brand-soft text-brand`.
- **IndiaMap**: `<svg viewBox>` with one `<path>` per region, `fill-surface-2` → `fill-brand/30` → `fill-brand` by count; region tap via event delegation on `<svg>`.

## Do / Don't

- ✅ Edit generated shadcn files directly. ❌ Wrap a shadcn component in another styled wrapper.
- ✅ Token classes (`bg-brand`). ❌ `bg-[#5A3BE7]`.
- ✅ One Motion `LazyMotion` provider at root. ❌ Importing `motion` (full) in leaf components.
- ✅ Icons imported individually. ❌ `import * as Icons`.
