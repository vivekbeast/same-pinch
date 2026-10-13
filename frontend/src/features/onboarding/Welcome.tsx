// /welcome — play first, sign up after (docs/UI_DIRECTION.md v2 §3): a 3-round practice game, then
// language + 18+, then Home with a short tour. "I already play" → Google or restore code.
import { ChevronLeft, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { REGIONS, UI_LANGS, type UiLang } from "@shared";
import { errorText } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ApiError, googleStartUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { chooseLang, savedLang, useConfig, useDemo, useRestore, useStartAnonymous } from "@/lib/session";
import { queueTour } from "@/lib/tour";
import { withMotion } from "@/components/motion-root";
import { Practice } from "./Practice";

type Step = "practice" | "language" | "restore";

// ---------- Language + age ----------
const LANG_META: Record<UiLang, { glyph: string; own: string; en: string }> = {
  en: { glyph: "A", own: "English", en: "English" },
  hi: { glyph: "अ", own: "हिंदी", en: "Hindi" },
  kn: { glyph: "ಅ", own: "ಕನ್ನಡ", en: "Kannada" },
  ta: { glyph: "அ", own: "தமிழ்", en: "Tamil" },
};

function LanguageStep({ onBack }: { onBack: () => void }) {
  const [lang, setLangState] = useState<UiLang>(savedLang());
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const start = useStartAnonymous();
  const navigate = useNavigate();
  const ready = adult && terms && !!stateCode;
  const regions = useMemo(() => [...REGIONS].sort((a, b) => a.name.localeCompare(b.name)), []);
  const field =
    "h-12 w-full rounded-tile border-2 border-line bg-surface px-4 text-[16px] text-ink focus-visible:border-brand focus-visible:outline-none";

  return (
    <form
      className="flex w-full max-w-[520px] flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        start.mutate(
          { uiLang: lang, stateCode, city: city.trim() || undefined },
          {
            onSuccess: () => {
              queueTour();
              navigate("/", { replace: true });
            },
          },
        );
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit cursor-pointer items-center gap-1 text-[15px] font-bold text-brand"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {t("common.back")}
      </button>
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-black text-ink">{t("language.title")}</h1>
        <p className="text-[16px] text-ink-muted">{t("language.sub")}</p>
      </div>

      {/* Language: a 2×2 grid, not a tall list. */}
      <div role="radiogroup" aria-label={t("language.title")} className="grid grid-cols-2 gap-2.5">
        {UI_LANGS.map((l) => {
          const meta = LANG_META[l];
          const on = l === lang;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setLangState(l);
                void chooseLang(l);
              }}
              className={cn(
                "pop-sm flex cursor-pointer items-center gap-3 rounded-tile p-3 text-left",
                on ? "bg-lime" : "bg-surface",
              )}
            >
              <span lang={l} className="grid size-10 shrink-0 place-items-center rounded-icon bg-surface-2 text-xl font-black text-ink">
                {meta.glyph}
              </span>
              <span className="min-w-0">
                <span lang={l} className="block truncate text-[16px] font-bold text-ink">
                  {meta.own}
                </span>
                {meta.own !== meta.en ? <span className="block text-[13px] text-ink-muted">{meta.en}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Where you are: coarse on purpose — a state, optionally a city. Never GPS, never an address. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[16px] font-bold text-ink">{t("signup.where")}</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t("settings.state")}</span>
            <select required value={stateCode} onChange={(e) => setStateCode(e.target.value)} className={field}>
              <option value="" disabled>
                {t("signup.state_pick")}
              </option>
              {regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t("settings.city")}</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value.slice(0, 40))}
              placeholder={t("signup.city_optional")}
              autoComplete="address-level2"
              className={field}
            />
          </label>
        </div>
        <p className="text-[13px] text-ink-muted">{t("signup.where_why")}</p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label className="pop-sm flex cursor-pointer items-center gap-3 rounded-tile bg-surface p-3.5">
          <input
            type="checkbox"
            checked={adult}
            onChange={(e) => setAdult(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="text-[15px] font-semibold text-ink">{t("language.age")}</span>
        </label>
        <label className="pop-sm flex cursor-pointer items-center gap-3 rounded-tile bg-surface p-3.5">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="text-[15px] font-semibold text-ink">
            {t("signup.terms_pre")}{" "}
            {/* Opens in a new tab so the form keeps what's been filled in. */}
            <a href="/terms" target="_blank" rel="noopener" className="text-brand underline underline-offset-2">
              {t("signup.terms_link")}
            </a>
          </span>
        </label>
      </div>

      {start.error ? <p role="alert" className="text-danger">{errorText(start.error)}</p> : null}
      <Button type="submit" variant="play" block disabled={!ready} busy={start.isPending}>
        {start.isPending ? t("language.starting") : t("language.continue")}
      </Button>
    </form>
  );
}

// ---------- Restore: Google, code, or the demo ----------
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"
      />
    </svg>
  );
}

function RestoreStep({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");
  const restore = useRestore();
  const demo = useDemo();
  const config = useConfig().data;
  const navigate = useNavigate();
  const wrong = restore.error instanceof ApiError && restore.error.code === "NOT_FOUND";

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit cursor-pointer items-center gap-1 text-[15px] font-extrabold text-brand"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {t("common.back")}
      </button>
      <h1 className="text-[30px] leading-tight font-black text-ink">{t("restore.title")}</h1>

      {config?.linking.google ? (
        <>
          <Button variant="light" block asChild>
            <a href={googleStartUrl("login", "/")}>
              <GoogleMark />
              {t("restore.google")}
            </a>
          </Button>
          <p className="text-center text-[15px] text-ink-muted">{t("restore.or")}</p>
        </>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          restore.mutate(code, { onSuccess: () => navigate("/", { replace: true }) });
        }}
      >
        <label htmlFor="code" className="text-[15px] font-semibold text-ink-2">
          {t("restore.code_label")}
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) =>
            setCode(
              e.target.value
                .toUpperCase()
                .replace(/[^0-9A-Z]/g, "")
                .slice(0, 8),
            )
          }
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          spellCheck={false}
          placeholder="SAME7777"
          aria-describedby="code-hint"
          aria-invalid={wrong || undefined}
          className={cn(
            "h-16 rounded-full bg-surface px-5 text-center text-[30px] font-black tracking-[0.22em] text-ink uppercase pop placeholder:text-ink-faint/60 focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none",
            wrong && "border-danger",
          )}
        />
        <p id="code-hint" className={cn("text-[15px]", wrong ? "text-danger" : "text-ink-muted")}>
          {wrong ? t("restore.wrong") : restore.error ? errorText(restore.error) : t("restore.code_hint")}
        </p>
        <Button type="submit" block disabled={code.length !== 8} busy={restore.isPending}>
          <RotateCcw className="size-5" aria-hidden />
          {t("restore.cta")}
        </Button>
      </form>

      {config?.demoMode ? (
        <Button
          variant="ghost"
          block
          busy={demo.isPending}
          onClick={() => demo.mutate(undefined, { onSuccess: () => navigate("/", { replace: true }) })}
        >
          {t("restore.demo")}
        </Button>
      ) : null}
    </div>
  );
}

// ---------- The screen ----------
function Welcome() {
  const [step, setStep] = useState<Step>("practice");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#EDF1FC";
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  if (step === "practice")
    return <Practice onFinish={() => setStep("language")} onRestore={() => setStep("restore")} />;
  return (
    <main className="flex min-h-dvh justify-center px-5 pt-8 pb-12 sm:px-6 md:items-center md:px-8">
      {step === "language" ? (
        <LanguageStep onBack={() => setStep("practice")} />
      ) : (
        <RestoreStep onBack={() => setStep("practice")} />
      )}
    </main>
  );
}

export default withMotion(Welcome);
