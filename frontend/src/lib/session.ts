// Session & player state shared by every screen: Me, public config, sign-in helpers, local prefs.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api as contract, type UiLang, type z } from "@shared";
import { api, ApiError } from "./api";
import { syncPrefs } from "./prefs";
import { currentLang, setLang } from "./i18n";

// ---------- Local prefs (per device; never needed for correctness) ----------
const ONBOARDED = "sp.onboarded";
const LANG = "sp.lang";
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
export const isOnboarded = () => store.get(ONBOARDED) === "1";
export const markOnboarded = () => store.set(ONBOARDED, "1");
export const savedLang = (): UiLang => (store.get(LANG) as UiLang) || "en";
export async function chooseLang(lang: UiLang) {
  store.set(LANG, lang);
  await setLang(lang);
}

// ---------- Queries ----------
export const meKey = ["me"] as const;

export type Me = z.infer<typeof contract.Me>;

/**
 * Current player. A 401 means the session is gone: never invent a replacement account (that would hide the
 * player's real one — wallet, flame, badges). AuthGate sends them to /welcome, where "I already play"
 * restores it (D45).
 */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => (await api("/me", { schema: "MeResponse" })).user,
    staleTime: 15_000,
    retry: (n, e) => !(e instanceof ApiError && e.code === "UNAUTHENTICATED") && n < 2,
  });
}

/** Session lost on a device that had played: start over at /welcome (restore lives there). */
export const forgetOnboarding = () => {
  try {
    localStorage.removeItem(ONBOARDED);
  } catch {
    /* storage blocked */
  }
};

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api("/config", { schema: "GameConfigPublic" }),
    staleTime: 5 * 60_000,
  });
}

/** Keep the cached Me in sync after any response that returns it. */
export function useSetMe() {
  const qc = useQueryClient();
  return (me: Me) => {
    qc.setQueryData(meKey, me);
    syncPrefs(me.settings);
    if (me.uiLang !== currentLang()) void setLang(me.uiLang);
  };
}

/** Sign-up (D45): language, 18+, terms, and a coarse location (state required, city optional). */
export function useStartAnonymous() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: { uiLang: UiLang; stateCode: string; city?: string }) =>
      api("/auth/anon", {
        method: "POST",
        body: { ...input, ageConfirmed: true, termsAccepted: true },
        schema: "MeResponse",
      }),
    onSuccess: ({ user }) => {
      markOnboarded();
      setMe(user);
    },
  });
}

export function useRestore() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (code: string) =>
      api("/auth/restore", { method: "POST", body: { code }, schema: "MeResponse" }),
    onSuccess: ({ user }) => {
      markOnboarded();
      setMe(user);
    },
  });
}

export function useDemo() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: () => api("/auth/demo", { method: "POST", schema: "MeResponse" }),
    onSuccess: ({ user }) => {
      markOnboarded();
      setMe(user);
    },
  });
}

export const patchMe = (body: object) => api("/me", { method: "PATCH", body, schema: "MeResponse" });
