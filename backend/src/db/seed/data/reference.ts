// Reference data: tunable game config, badge rules, seeded partner accounts.
import type { BadgeId, Lang, RegionCode } from "@shared";
import { DEFAULT_CONFIG } from "../../../domain/config";

/** Game config comes from the typed defaults so seed and services never disagree. */
export const GAME_CONFIG: Record<string, unknown> = DEFAULT_CONFIG;

export const BADGES: { id: BadgeId; sort: number; rule: Record<string, unknown> }[] = [
  { id: "first_pinch", sort: 1, rule: { type: "pinches", count: 1 } },
  { id: "bhasha_bridge", sort: 2, rule: { type: "bhasha_pinches", count: 1 } },
  { id: "double_pinch", sort: 3, rule: { type: "multi_match_round", matches: 2 } },
  { id: "fire_starter", sort: 4, rule: { type: "flame", days: 3 } },
  { id: "week_of_flames", sort: 5, rule: { type: "flame", days: 7 } },
  { id: "burnt_hunter", sort: 6, rule: { type: "pinch_with_burnt", burnt: 3 } },
  { id: "sound_mind", sort: 7, rule: { type: "kind_pinches", kind: "sound", count: 10 } },
  { id: "vibe_twin", sort: 8, rule: { type: "kind_pinches", kind: "vibe", count: 10 } },
  { id: "explorer", sort: 9, rule: { type: "regions", count: 5 } },
  { id: "bharat_synced", sort: 10, rule: { type: "regions", count: 36 } },
  { id: "india_brain", sort: 11, rule: { type: "daily_perfect" } },
  { id: "sharp_eye", sort: 12, rule: { type: "gold_streak", count: 20 } },
  { id: "brain_twin", sort: 13, rule: { type: "twin", count: 3 } },
];

/**
 * Seeded partner accounts, spread across India so the Sync Map fills during a demo.
 * style: how this person writes words — native script, romanised, or English.
 */
export interface SeedUser {
  handle: string;
  state: RegionCode;
  city: string;
  avatar: string;
  style: { lang: Lang; script: number; roman: number; en: number }; // weights
}

const kn = { lang: "kn", script: 0.45, roman: 0.25, en: 0.3 } as const;
const hi = { lang: "hi", script: 0.3, roman: 0.35, en: 0.35 } as const;
const ta = { lang: "ta", script: 0.45, roman: 0.2, en: 0.35 } as const;
const en = { lang: "en", script: 0, roman: 0.1, en: 0.9 } as const; // romanised → Hindi
const u = (handle: string, state: RegionCode, city: string, avatar: string, style: SeedUser["style"]): SeedUser => ({
  handle,
  state,
  city,
  avatar,
  style,
});

export const SEED_USERS: SeedUser[] = [
  u("asha_shillong", "ML", "Shillong", "a3", en),
  u("ravi_blr", "KA", "Bengaluru", "a1", kn),
  u("meena_mysuru", "KA", "Mysuru", "a4", kn),
  u("nandini_hubli", "KA", "Hubballi", "a6", kn),
  u("priya_chennai", "TN", "Chennai", "a2", ta),
  u("karthik_madurai", "TN", "Madurai", "a5", ta),
  u("suresh_cbe", "TN", "Coimbatore", "a7", ta),
  u("mariya_pdy", "PY", "Puducherry", "a8", ta),
  u("divya_kochi", "KL", "Kochi", "a9", en),
  u("anand_pune", "MH", "Pune", "a10", hi),
  u("sneha_mumbai", "MH", "Mumbai", "a11", en),
  u("rahul_delhi", "DL", "New Delhi", "a12", hi),
  u("pooja_lucknow", "UP", "Lucknow", "a2", hi),
  u("vikram_jaipur", "RJ", "Jaipur", "a1", hi),
  u("neha_patna", "BR", "Patna", "a4", hi),
  u("sourav_kolkata", "WB", "Kolkata", "a5", en),
  u("ankita_bhopal", "MP", "Bhopal", "a6", hi),
  u("rohit_chd", "CH", "Chandigarh", "a7", hi),
  u("fatima_hyd", "TG", "Hyderabad", "a3", en),
  u("sai_vizag", "AP", "Visakhapatnam", "a8", en),
  u("manoj_raipur", "CG", "Raipur", "a9", hi),
  u("tenzing_gangtok", "SK", "Gangtok", "a10", en),
  u("joy_guwahati", "AS", "Guwahati", "a11", en),
  u("mawii_aizawl", "MZ", "Aizawl", "a12", en),
  u("ritu_dehradun", "UK", "Dehradun", "a1", hi),
  u("aman_shimla", "HP", "Shimla", "a2", hi),
  u("gurpreet_asr", "PB", "Amritsar", "a3", hi),
  u("dev_goa", "GA", "Panaji", "a4", en),
  u("kiran_amd", "GJ", "Ahmedabad", "a5", hi),
  u("bikash_bbsr", "OD", "Bhubaneswar", "a6", hi),
  u("imchen_kohima", "NL", "Kohima", "a7", en),
  u("thoibi_imphal", "MN", "Imphal", "a8", en),
  u("rina_agartala", "TR", "Agartala", "a9", en),
  u("tage_itanagar", "AR", "Itanagar", "a10", en),
  u("zoya_srinagar", "JK", "Srinagar", "a11", hi),
  u("stanzin_leh", "LA", "Leh", "a12", en),
  u("hari_ranchi", "JH", "Ranchi", "a1", hi),
  u("rehana_kavaratti", "LD", "Kavaratti", "a2", en),
  u("nikhil_portblair", "AN", "Port Blair", "a3", en),
  u("ishaan_daman", "DH", "Daman", "a4", hi),
  u("parveen_gurugram", "HR", "Gurugram", "a5", hi),
];

/** Demo account (docs/DATA_MODEL.md §3): reachable via restore code or /welcome?demo=1 when DEMO_MODE=true. */
export const DEMO_USER = {
  handle: "ritika_demo",
  state: "KA" as RegionCode,
  city: "Hubballi",
  avatar: "a2",
  uiLang: "en" as const,
  restoreCode: "SAME7777",
  googleSub: "demo-placeholder-sub", // not a real Google account
  googleDisplay: "r•••@example.com",
};
