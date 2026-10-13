// /terms — Terms & Conditions (docs/DECISIONS.md D45). Public: readable before signing up (the sign-up
// checkbox opens it in a new tab). Plain language, one short paragraph per promise.
import { useEffect } from "react";
import { Link } from "react-router";
import { TERMS_VERSION } from "@shared";
import { Logo } from "@/components/brand";
import { t, type Key } from "@/lib/i18n";

const SECTIONS = ["play", "money", "age", "data", "location", "fair", "delete", "changes"] as const;

export default function Terms() {
  useEffect(() => {
    document.title = `${t("terms.title")} · Same Pinch`;
  }, []);
  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <article className="pop mx-auto flex w-full max-w-[720px] flex-col gap-5 rounded-card bg-surface p-5 sm:p-6 md:p-8">
        <header className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <h1 className="text-[26px] leading-tight font-black text-ink md:text-[30px]">{t("terms.title")}</h1>
            <p className="text-[14px] text-ink-muted">{t("terms.version", { v: TERMS_VERSION })}</p>
          </div>
        </header>
        {SECTIONS.map((s) => (
          <section key={s} className="flex flex-col gap-1">
            <h2 className="text-[18px] font-bold text-ink">{t(`terms.${s}.title` as Key)}</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">{t(`terms.${s}.body` as Key)}</p>
          </section>
        ))}
        <Link to="/" className="w-fit font-bold text-brand underline underline-offset-2">
          {t("notfound.home")}
        </Link>
      </article>
    </main>
  );
}
