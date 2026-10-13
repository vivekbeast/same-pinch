// /settings (docs/SCREENS.md §13). Fair Play Promise first; then profile, play, keeping the account safe
// (Google + restore code), and your data. Tablet/desktop: a sticky section index on the left.
import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  CircleCheck,
  Copy,
  Download,
  KeyRound,
  LogOut,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "@/lib/toast";
import { REGIONS, UI_LANGS, type UiLang } from "@shared";
import { IconTile, NightCard, Panel, Row } from "@/components/cards";
import { Page, PageHeader } from "@/components/page";
import { errorText } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { API, api, googleStartUrl } from "@/lib/api";
import { t } from "@/lib/i18n";
import { forgetPlayer, queryClient } from "@/lib/query";
import { chooseLang, patchMe, useConfig, useMe, useSetMe } from "@/lib/session";
import { useFamily } from "@/lib/use-family";

const LANG_NAME: Record<UiLang, string> = { en: "English", hi: "हिंदी", kn: "ಕನ್ನಡ", ta: "தமிழ்" };
const SECTIONS = ["profile", "play", "safe", "answers"] as const;
const SECTION_TITLE = {
  profile: "settings.profile",
  play: "settings.play",
  safe: "settings.safe",
  answers: "settings.answers",
} as const;

function Section({ id, children }: { id: (typeof SECTIONS)[number]; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`h-${id}`} className="flex scroll-mt-8 flex-col gap-3">
      <h2 id={`h-${id}`} className="px-1 text-section font-bold">
        {t(SECTION_TITLE[id])}
      </h2>
      {children}
    </section>
  );
}

function Promise_() {
  const stats = [
    ["₹0", t("settings.promise.deposits")],
    ["₹50", t("settings.promise.min")],
    ["24 h", t("settings.promise.wait")],
  ] as const;
  return (
    <NightCard
      title={t("settings.promise.title")}
      sub={t("settings.promise.sub")}
      aside={<ShieldCheck className="size-8 shrink-0 text-success-bright" strokeWidth={1.75} aria-hidden />}
      chips={
        <div className="grid w-full grid-cols-3 gap-3">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-tile bg-night-2 p-3">
              <p className="text-[32px] leading-none font-bold text-success-bright">{v}</p>
              <p className="mt-1 text-sm text-white/70">{l}</p>
            </div>
          ))}
        </div>
      }
    />
  );
}

function ProfileForm() {
  const me = useMe().data!;
  const setMe = useSetMe();
  const [handle, setHandle] = useState(me.handle);
  const [stateCode, setStateCode] = useState(me.stateCode ?? "");
  const [city, setCity] = useState(me.city ?? "");
  const save = useMutation({
    mutationFn: () => patchMe({ handle, stateCode: stateCode || null, city: city.trim() || null }),
    onSuccess: ({ user }) => {
      setMe(user);
      toast.success(t("settings.saved"));
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
  const field =
    "h-12 w-full rounded-tile bg-surface-2 px-4 text-[17px] text-ink focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none";
  return (
    <Panel className="p-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-ink-2">{t("settings.name")}</span>
          <input
            value={handle}
            onChange={(e) =>
              setHandle(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, "")
                  .slice(0, 20),
              )
            }
            className={field}
            aria-describedby="handle-hint"
          />
          <span id="handle-hint" className="text-[15px] text-ink-muted">
            {t("settings.name_hint")}
          </span>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-ink-2">{t("settings.state")}</span>
            <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className={field}>
              <option value="">{t("settings.state_none")}</option>
              {[...REGIONS]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-semibold text-ink-2">{t("settings.city")}</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value.slice(0, 60))}
              className={field}
              autoComplete="address-level2"
            />
          </label>
        </div>
        {save.error ? <p className="text-danger">{errorText(save.error)}</p> : null}
        <Button
          type="submit"
          size="md"
          busy={save.isPending}
          disabled={handle.length < 3}
          className="self-start"
        >
          {t("settings.save")}
        </Button>
      </form>
    </Panel>
  );
}

function PlayPrefs() {
  const me = useMe().data!;
  const setMe = useSetMe();
  const s = me.settings as { sound?: boolean; vibration?: boolean; dataSaver?: boolean; moreTime?: boolean };
  const update = useMutation({
    mutationFn: (body: object) => patchMe(body),
    onSuccess: ({ user }) => setMe(user),
  });
  const toggle = (key: string, value: boolean) => update.mutate({ settings: { [key]: value } });
  return (
    <Panel>
      <div className="flex items-center gap-4 px-5 py-3">
        <span className="flex-1 text-[17px] font-medium">{t("settings.language")}</span>
        <select
          value={me.uiLang}
          onChange={(e) => {
            const lang = e.target.value as UiLang;
            void chooseLang(lang);
            update.mutate({ uiLang: lang });
          }}
          aria-label={t("settings.language")}
          className="h-11 rounded-full bg-brand-soft px-4 font-semibold text-brand-ink"
        >
          {UI_LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAME[l]}
            </option>
          ))}
        </select>
      </div>
      {(
        [
          ["sound", t("settings.sound"), undefined, s.sound !== false],
          ["vibration", t("settings.vibration"), undefined, s.vibration !== false],
          ["dataSaver", t("settings.data_saver"), t("settings.data_saver_sub"), !!s.dataSaver],
          ["moreTime", t("settings.more_time"), t("settings.more_time_sub"), !!s.moreTime],
        ] as const
      ).map(([key, title, sub, on]) => (
        <Row
          key={key}
          title={title}
          sub={sub}
          trailing={<Switch checked={on} onChange={(v) => toggle(key, v)} label={title} />}
        />
      ))}
    </Panel>
  );
}

function KeepSafe() {
  const me = useMe().data!;
  const config = useConfig().data;
  const setMe = useSetMe();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const google = me.identities.find((i) => i.provider === "google");

  const reveal = useMutation({
    mutationFn: () => api("/auth/restore-code", { method: "POST" }) as Promise<{ code: string }>,
    onSuccess: (r) => setCode(r.code),
  });
  const unlink = useMutation({
    mutationFn: () => api("/auth/link/google", { method: "DELETE", schema: "MeResponse" }),
    onSuccess: ({ user }) => setMe(user),
  });
  const logout = useMutation({
    mutationFn: (all: boolean) => api(all ? "/auth/logout-all" : "/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      try {
        localStorage.removeItem("sp.onboarded");
      } catch {
        /* ignore */
      }
      await forgetPlayer();
      navigate("/welcome", { replace: true });
    },
  });

  return (
    <Panel>
      {config?.linking.google ? (
        <Row
          icon={
            <IconTile tone={google ? "success" : "soft"}>
              <ShieldCheck strokeWidth={1.75} />
            </IconTile>
          }
          title={t("settings.google")}
          sub={google ? t("settings.google_linked", { email: google.display }) : t("settings.google_sub")}
          trailing={
            google ? (
              <Button variant="ghost" size="sm" busy={unlink.isPending} onClick={() => unlink.mutate()}>
                {t("settings.google_unlink")}
              </Button>
            ) : (
              <Button variant="soft" size="sm" asChild>
                <a href={googleStartUrl("link", "/me/settings")}>{t("settings.google_link")}</a>
              </Button>
            )
          }
        />
      ) : null}
      <Row
        icon={
          <IconTile>
            <KeyRound strokeWidth={1.75} />
          </IconTile>
        }
        title={t("settings.restore_code")}
        sub={code ? t("settings.restore_new") : t("settings.restore_hint")}
        trailing={
          code ? (
            <button
              type="button"
              onClick={() =>
                navigator.clipboard?.writeText(code).then(() => toast.success(t("common.copied")))
              }
              className="flex items-center gap-2 rounded-full bg-marigold-soft px-3 py-1.5 text-xl font-black tracking-[0.18em] pop-sm"
            >
              {code}
              <Copy className="size-4 text-ink-muted" aria-label={t("common.copy")} />
            </button>
          ) : (
            <Button variant="soft" size="sm" busy={reveal.isPending} onClick={() => reveal.mutate()}>
              {t("settings.restore_show")}
            </Button>
          )
        }
      />
      <Row
        icon={
          <IconTile tone="neutral">
            <LogOut strokeWidth={1.75} />
          </IconTile>
        }
        title={t("settings.logout")}
        onClick={() => logout.mutate(false)}
      />
      <Row
        icon={
          <IconTile tone="neutral">
            <LogOut strokeWidth={1.75} />
          </IconTile>
        }
        title={t("settings.logout_all")}
        onClick={() => logout.mutate(true)}
      />
    </Panel>
  );
}

function YourAnswers() {
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  const del = useMutation({
    mutationFn: () => api("/me", { method: "DELETE" }),
    onSuccess: async () => {
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await forgetPlayer();
      navigate("/welcome", { replace: true });
    },
  });
  return (
    <>
      <Panel className="flex flex-col gap-3 p-5">
        {(["settings.answers.1", "settings.answers.2", "settings.answers.3"] as const).map((k) => (
          <p key={k} className="flex items-start gap-3 text-[17px] text-ink-2">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
            {t(k)}
          </p>
        ))}
        <div className="mt-2 flex flex-wrap gap-3">
          <Button variant="soft" size="md" asChild>
            <a href={`${API}/me/export`} download>
              <Download className="size-5" aria-hidden />
              {t("settings.export")}
            </a>
          </Button>
          <Button variant="danger" size="md" onClick={() => setConfirm(true)}>
            <Trash2 className="size-5" aria-hidden />
            {t("settings.delete")}
          </Button>
        </div>
      </Panel>
      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        title={t("settings.delete_title")}
        description={t("settings.delete_sub")}
      >
        <div className="flex flex-col gap-3 md:flex-row-reverse">
          <Button variant="danger" busy={del.isPending} onClick={() => del.mutate()}>
            {t("settings.delete_cta")}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export default function Settings() {
  const family = useFamily();
  const body = (
    <div className="flex flex-col gap-8">
      <Section id="profile">
        <ProfileForm />
      </Section>
      <Section id="play">
        <PlayPrefs />
      </Section>
      <Section id="safe">
        <KeepSafe />
      </Section>
      <Section id="answers">
        <YourAnswers />
      </Section>
      <p className="px-1 text-sm text-ink-muted">Same Pinch v{import.meta.env.VITE_APP_VERSION ?? "0.1.0"}</p>
    </div>
  );
  return (
    <Page wide={family === "desktop"}>
      <PageHeader
        title={t("settings.title")}
        lead={
          <Link to="/me" className="mb-1 flex w-fit items-center gap-1 font-extrabold text-brand">
            <ChevronLeft className="size-5" strokeWidth={2.5} aria-hidden />
            {t("nav.me")}
          </Link>
        }
      />
      <Promise_ />
      {family === "phone" ? (
        body
      ) : (
        <div className="grid grid-cols-[220px_1fr] items-start gap-8">
          <nav aria-label={t("settings.title")} className="sticky top-8 flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s}
                href={`#${s}`}
                className="rounded-full px-4 py-2.5 text-[15px] font-medium text-ink-2 hover:bg-surface-2"
              >
                {t(SECTION_TITLE[s])}
              </a>
            ))}
          </nav>
          {body}
        </div>
      )}
    </Page>
  );
}
