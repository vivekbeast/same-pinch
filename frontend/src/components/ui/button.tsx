import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

// Jelly candy buttons (docs/UI_DIRECTION.md v3): a sticker edge, a darker lip underneath, a glossy top,
// and a squish when pressed. Lime is PLAY — the one thing on any screen you're meant to press.
const button = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-sans font-black select-none " +
    "disabled:cursor-not-allowed disabled:opacity-45 focus-visible:ring-4 focus-visible:ring-brand/40 focus-visible:outline-none",
  {
    variants: {
      variant: {
        play: "pop press bg-lime font-display tracking-tight text-ink [--lip:var(--color-lime-600)] hover:brightness-105",
        marigold: "pop press bg-marigold text-ink [--lip:var(--color-marigold-600)] hover:brightness-105",
        primary: "pop press bg-brand text-white [--lip:var(--color-brand-ink)] hover:bg-brand-600",
        light: "pop press bg-surface text-ink [--lip:var(--color-line)] hover:bg-surface-2",
        soft: "pop-sm press bg-brand-soft text-brand-ink [--lip:var(--color-brand-400)] hover:bg-brand-soft/80",
        danger: "pop-sm press bg-danger-soft text-danger [--lip:var(--color-pinch-soft)]",
        ghost: "bg-transparent text-brand hover:bg-brand-soft/70",
        glass: "border-2 border-white/40 bg-white/15 text-white backdrop-blur-md", // only over photos
      },
      // Sizes declare every breakpoint (docs/RESPONSIVE.md R2).
      size: {
        xl: "h-16 px-8 text-[22px] sm:h-16 sm:text-[22px] md:h-16 md:text-[22px] lg:h-16 lg:text-[22px] xl:h-16 xl:text-[22px]",
        lg: "h-14 px-6 text-[18px] sm:h-14 sm:text-[18px] md:h-13 md:text-[17px] lg:h-13 lg:text-[17px] xl:h-12 xl:text-[17px]",
        md: "h-11 px-5 text-[16px] sm:h-11 sm:px-5 md:h-11 md:px-5 lg:h-10 lg:px-5 xl:h-10 xl:px-5",
        sm: "h-9 px-4 text-[15px] sm:h-9 sm:px-4 md:h-9 md:px-4 lg:h-9 lg:px-4 xl:h-9 xl:px-4",
        icon: "size-12 sm:size-12 md:size-11 lg:size-11 xl:size-10",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "lg", block: false },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  asChild?: boolean;
  /** Spinner inside the button; keeps its width (docs/UX_STATES.md §3). */
  busy?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild,
  busy,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const cls = cn(button({ variant, size, block }), className);
  // Slot takes exactly one child: links rendered via asChild never show a spinner.
  if (asChild) {
    return (
      <Slot className={cls} {...props}>
        {children}
      </Slot>
    );
  }
  return (
    <button className={cls} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy ? <Spinner className="size-5" /> : null}
      {children}
    </button>
  );
}
