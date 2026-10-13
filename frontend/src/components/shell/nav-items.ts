import { CalendarCheck, House, UserRound, Users, type LucideIcon } from "lucide-react";
import type { Key } from "@/lib/i18n";

export interface NavItem {
  to: string;
  label: Key;
  icon: LucideIcon;
}

/** Home · Daily · (Play) · People · Me (docs/DECISIONS.md D41): people first; your stuff lives in Me. */
export const PRIMARY: NavItem[] = [
  { to: "/", label: "nav.home", icon: House },
  { to: "/daily", label: "nav.daily", icon: CalendarCheck },
  { to: "/people", label: "nav.people", icon: Users },
  { to: "/me", label: "nav.me", icon: UserRound },
];
