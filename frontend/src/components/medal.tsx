// A badge medal: chunky round sticker, filled when earned, a dashed outline when locked. Shared by
// Me, the badge shelf and the Results reward popups.
import {
  Award,
  Brain,
  Eye,
  Flame,
  Languages,
  Link2,
  Map as MapIcon,
  Palette,
  Snowflake,
  Star,
  Target,
  Trophy,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { BadgeId } from "@shared";
import { cn } from "@/lib/cn";

const ICON: Record<BadgeId, LucideIcon> = {
  first_pinch: Target,
  bhasha_bridge: Languages,
  double_pinch: Link2,
  fire_starter: Flame,
  week_of_flames: Zap,
  burnt_hunter: Snowflake,
  sound_mind: Volume2,
  vibe_twin: Palette,
  explorer: MapIcon,
  bharat_synced: Award,
  india_brain: Trophy,
  sharp_eye: Eye,
  brain_twin: Brain,
};
const FILL = ["bg-marigold", "bg-pinch", "bg-brand-400", "bg-success-bright", "bg-sky"];

export function Medal({
  id,
  earned,
  i = 0,
  size = "md",
}: {
  id: BadgeId;
  earned: boolean;
  i?: number;
  size?: "md" | "lg";
}) {
  const Icon = ICON[id] ?? Star;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        size === "lg" ? "size-28" : "size-18 md:size-20",
        earned
          ? cn("text-ink pop", FILL[i % FILL.length])
          : "border-[3px] border-dashed border-line text-ink-faint",
      )}
    >
      <Icon className={size === "lg" ? "size-12" : "size-8"} strokeWidth={2.25} aria-hidden />
    </span>
  );
}
