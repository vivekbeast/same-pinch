// Identity + map pieces. (v1 number plates are gone — docs/UI_DIRECTION.md v2.)
import { cn } from "@/lib/cn";

const AVATAR_BG = ["bg-marigold", "bg-brand-400", "bg-pinch", "bg-success-bright", "bg-sky", "bg-brand-soft"];

/** A round avatar with the player's initial; colour picked from the avatar id. */
export function Avatar({
  handle,
  avatar,
  size = 44,
  className,
}: {
  handle: string;
  avatar?: string;
  size?: number;
  className?: string;
}) {
  const n = Number((avatar ?? "a1").replace(/\D/g, "")) || 1;
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-black text-ink uppercase pop-sm",
        AVATAR_BG[n % AVATAR_BG.length],
        className,
      )}
    >
      {handle.slice(0, 1)}
    </span>
  );
}

/** Player identity: avatar + handle + level chip. Replaces the v1 vehicle-style player plate. */
export function PlayerTag({
  handle,
  level,
  avatar,
  size = "md",
  className,
}: {
  handle: string;
  level: number;
  avatar?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
      aria-label={`${handle}, level ${level}`}
    >
      <Avatar handle={handle} avatar={avatar} size={size === "lg" ? 52 : 40} />
      <span aria-hidden className="flex min-w-0 flex-col leading-tight">
        <span className={cn("truncate font-black text-ink", size === "lg" ? "text-[22px]" : "text-[17px]")}>
          {handle}
        </span>
        <span className="text-[13px] font-bold text-ink-muted">Lv {level}</span>
      </span>
    </span>
  );
}

export type StateStatus = "synced" | "new" | "notyet";

/** One state/UT on the India map: rounded tile, filled when synced. */
export function StatePlate({
  code,
  name,
  status,
  pinches,
  showCount = false,
  onClick,
  className,
}: {
  code: string;
  name: string;
  status: StateStatus;
  pinches?: number;
  showCount?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={name}
      aria-label={`${name}: ${status === "notyet" ? "not yet synced" : `synced, ${pinches ?? 0} pinches`}`}
      className={cn(
        "@container relative grid aspect-square w-full place-items-center rounded-[10px] transition-transform",
        onClick && "cursor-pointer active:scale-95",
        status === "notyet" ? "border-2 border-dashed border-line bg-transparent" : "pop-sm",
        status === "synced" && "bg-brand text-white",
        status === "new" && "bg-marigold text-ink",
        className,
      )}
    >
      <span className={cn("text-[30cqw] leading-none font-black", status === "notyet" && "text-ink-faint")}>
        {code}
      </span>
      {showCount && status !== "notyet" && pinches ? (
        <span aria-hidden className="absolute right-1 bottom-0.5 text-[20cqw] font-extrabold opacity-80">
          {pinches}
        </span>
      ) : null}
    </Tag>
  );
}
