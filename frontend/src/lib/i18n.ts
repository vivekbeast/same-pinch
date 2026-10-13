// A 40-line typed t() (docs/CONTENT_I18N.md §5). English ships in the main chunk; other languages
// load on demand and fall back to English key by key.
import { useSyncExternalStore } from "react";
import en from "../locales/en.json";
import type { UiLang } from "@shared";

export type Key = keyof typeof en;
type Dict = Partial<Record<Key, string>>;

const loaders: Record<Exclude<UiLang, "en">, () => Promise<{ default: Dict }>> = {
  hi: () => import("../locales/hi.json"),
  kn: () => import("../locales/kn.json"),
  ta: () => import("../locales/ta.json"),
};

let lang: UiLang = "en";
let dict: Dict = en;
const listeners = new Set<() => void>();

export async function setLang(next: UiLang) {
  dict = next === "en" ? en : { ...en, ...(await loaders[next]()).default };
  lang = next;
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

export const currentLang = () => lang;

export function t(key: Key, params?: Record<string, string | number>): string {
  let s = dict[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Plural keys: `foo_one` / `foo_other`, chosen with Intl.PluralRules. */
export function tn(base: string, n: number, params: Record<string, string | number> = {}) {
  const form = new Intl.PluralRules(`${lang}-IN`).select(n) === "one" ? "one" : "other";
  return t(`${base}_${form}` as Key, { n, ...params });
}

/** Re-render on language change. */
export function useLang() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lang,
  );
}

/** Loose lookup for server-provided keys (prompt.q.*, level.*, badge.*). */
export const tk = (key: string, params?: Record<string, string | number>) => t(key as Key, params);
