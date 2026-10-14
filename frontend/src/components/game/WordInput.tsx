// Word entry: up to 3 speech bubbles. Script decides the language; for Latin words the player can tap
// the language tag to switch EN → HI → KN → TA (romanised). Enter/comma adds; Backspace on empty removes.
// Smart Chips (D39) finish the word you're typing — same language only, never a translation.
import { m, AnimatePresence } from "motion/react";
import { forwardRef, useDeferredValue, useLayoutEffect, useMemo, useState, type KeyboardEvent } from "react";
import { detectLang, LIMITS, normalize, type Lang } from "@shared";
import { LANG_TAG, WordBubble } from "@/components/words";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { t } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import { suggest, useWordList, type Suggestion } from "@/lib/words";

export interface Word {
  text: string;
  lang: Lang;
  burnt: boolean;
}

const LATIN_CYCLE: Lang[] = ["en", "hi", "kn", "ta"];
const isLatin = (s: string) => !/[^\p{Script=Latin}\p{N}\s'-]/u.test(s);

export const WordInput = forwardRef<
  HTMLInputElement,
  {
    words: Word[];
    onChange: (w: Word[]) => void;
    /** Called with the final list, including a word still in the text box. */
    onDrop: (words: Word[]) => void;
    burnt: string[];
    defaultLang: Lang;
    disabled?: boolean;
    placeholder: string;
    lang: string;
    /** Lets the parent read the final word list — including a half-typed word — at submit time. */
    flushRef?: { current: (() => Word[]) | null };
  }
>(function WordInput({ words, onChange, onDrop, burnt, defaultLang, disabled, placeholder, lang, flushRef }, ref) {
  const [text, setText] = useState("");
  const burntSet = new Set(burnt.map(normalize));

  /** Adds the typed word; returns the list as it will be after this keystroke. */
  const add = (): Word[] => {
    const clean = normalize(text);
    setText("");
    if (!clean || words.length >= LIMITS.maxWords || words.some((w) => normalize(w.text) === clean))
      return words;
    haptic.tick();
    const latinLang: Lang = defaultLang === "en" ? "en" : defaultLang;
    const next = [
      ...words,
      { text: text.trim(), lang: detectLang(clean, latinLang), burnt: burntSet.has(clean) },
    ];
    onChange(next);
    return next;
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onDrop(text.trim() ? add() : words);
      return;
    }
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (text.trim()) add();
      else if (e.key === "Enter" && words.length) onDrop(words);
      return;
    }
    if (e.key === "Backspace" && !text && words.length) onChange(words.slice(0, -1));
  };

  const cycleLang = (i: number) => {
    const w = words[i]!;
    if (!isLatin(w.text)) return;
    const next = LATIN_CYCLE[(LATIN_CYCLE.indexOf(w.lang) + 1) % LATIN_CYCLE.length]!;
    onChange(words.map((x, j) => (j === i ? { ...x, lang: next } : x)));
  };

  // Smart Chips: completions for the word being typed (2+ letters), from the cached word list. Computed
  // from a deferred copy of the text, so typed letters paint first and the list scan never delays them.
  const list = useWordList().data;
  const full = words.length >= LIMITS.maxWords;
  const typed = useDeferredValue(text);
  const chips = useMemo(
    () => (full || disabled ? [] : suggest(list, typed, (LATIN_CYCLE.includes(lang as Lang) ? lang : "en") as Lang)),
    [full, disabled, list, typed, lang],
  );
  // Parent submit (e.g. a tap on the photo) takes whatever is typed, even without Enter.
  useLayoutEffect(() => {
    if (!flushRef) return;
    flushRef.current = () => (text.trim() ? add() : words);
    return () => {
      flushRef.current = null;
    };
  });

  const pick = (c: Suggestion) => {
    if (full || words.some((w) => normalize(w.text) === c.text)) {
      setText("");
      return;
    }
    haptic.tick();
    onChange([...words, { text: c.text, lang: c.lang, burnt: burntSet.has(c.text) }]);
    setText("");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Only what you've added — no empty placeholder slots taking up a row. */}
      <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-3", words.length ? "pb-1" : "hidden")} aria-live="polite">
        <AnimatePresence initial={false}>
          {words.map((w, i) => (
            <m.span
              key={w.text}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.12 } }}
              transition={spring.bouncy}
            >
              <WordBubble
                word={w.text}
                lang={w.lang}
                state={w.burnt ? "burnt" : "idle"}
                onLangTap={isLatin(w.text) ? () => cycleLang(i) : undefined}
                onRemove={() => onChange(words.filter((_, j) => j !== i))}
                removeLabel={t("play.remove", { word: w.text })}
              />
            </m.span>
          ))}
        </AnimatePresence>
      </div>
      {chips.length ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("play.suggestions")}>
          {chips.map((c) => (
            <button
              key={`${c.lang}:${c.text}`}
              type="button"
              lang={c.lang}
              // Keep focus in the input: a blur would add the half-typed word first.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(c)}
              className="pop-sm press flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-lime-soft pr-3.5 pl-1.5 text-[16px] font-extrabold text-ink [--lip:var(--color-lime-600)]"
            >
              <span aria-hidden className="grid h-6 min-w-6 place-items-center rounded-full bg-surface px-1 text-[11px] font-black text-ink-2">
                {LANG_TAG[c.lang]}
              </span>
              {c.text}
            </button>
          ))}
        </div>
      ) : null}
      <input
        ref={ref}
        value={text}
        disabled={disabled || words.length >= LIMITS.maxWords}
        onChange={(e) => setText(e.target.value.slice(0, 40))}
        onKeyDown={onKey}
        onBlur={() => text.trim() && add()}
        placeholder={words.length >= LIMITS.maxWords ? t("play.max_words") : placeholder}
        aria-label={t("play.placeholder")}
        lang={lang}
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="h-14 w-full rounded-full bg-surface px-6 text-[19px] font-bold text-ink pop placeholder:font-semibold placeholder:text-ink-muted focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-60"
      />
    </div>
  );
});
