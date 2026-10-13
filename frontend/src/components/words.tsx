// Words are things people say, so they're chat-bubble stickers (docs/UI_DIRECTION.md v3). A language
// tag rides inside: EN / हि / ಕ / த — tap it to switch a Latin word's language.
import type { Lang } from "@shared";
import { cn } from "@/lib/cn";

export const LANG_TAG: Record<Lang, string> = { en: "EN", hi: "हि", kn: "ಕ", ta: "த", te: "తె", mr: "म" };
const LANG_BG: Record<Lang, string> = {
  en: "bg-lang-en",
  hi: "bg-lang-hi",
  kn: "bg-lang-kn",
  ta: "bg-lang-ta",
  te: "bg-lang-te",
  mr: "bg-lang-mr",
};

export type BubbleState = "idle" | "matched" | "burnt" | "partner" | "ghost";

export function WordBubble({
  word,
  lang,
  state = "idle",
  size = "md",
  side = "left",
  onLangTap,
  onRemove,
  removeLabel,
  className,
}: {
  word: string;
  lang: Lang;
  state?: BubbleState;
  size?: "sm" | "md" | "lg";
  /** Which bottom corner is squared off, chat-style (yours left, partner's right). */
  side?: "left" | "right";
  onLangTap?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  const pad = {
    sm: "h-9 pl-1.5 pr-3 text-[16px]",
    md: "h-11 pl-2 pr-4 text-[19px]",
    lg: "h-14 pl-2.5 pr-5 text-[24px]",
  }[size];
  const Tag = onLangTap ? "button" : "span";
  return (
    <span
      lang={lang}
      className={cn(
        "relative inline-flex max-w-full items-center gap-2 rounded-[22px] font-extrabold whitespace-nowrap",
        side === "left" ? "rounded-bl-[6px]" : "rounded-br-[6px]",
        pad,
        state === "ghost" ? "border-2 border-dashed border-ink-faint/60 bg-surface/40 text-transparent" : "pop-sm",
        state === "idle" && "bg-surface text-ink",
        state === "partner" && "bg-sky-soft text-ink",
        state === "matched" && "bg-lime text-ink",
        state === "burnt" && "bg-surface-2 text-ink-faint line-through",
        className,
      )}
    >
      {state !== "ghost" ? (
        <Tag
          {...(onLangTap
            ? { type: "button" as const, onClick: onLangTap, "aria-label": `Language ${lang}, tap to change` }
            : { "aria-hidden": true })}
          className={cn(
            "grid h-[1.45em] min-w-[1.6em] shrink-0 place-items-center rounded-full px-1 text-[0.55em] font-black text-white",
            onLangTap && "cursor-pointer",
            state === "burnt" ? "bg-ink-faint" : LANG_BG[lang],
          )}
        >
          {LANG_TAG[lang]}
        </Tag>
      ) : null}
      <span className="min-w-0 truncate">{word}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>
      ) : null}
    </span>
  );
}
