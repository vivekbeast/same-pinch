// Chutki (चुटकी — Hindi for "a pinch"): two cartoon fingertips with faces. Pure SVG + CSS, so it can live
// on every screen without loading the animation library. Poses carry meaning: idle, think, happy, sad, cheer.
import { cn } from "@/lib/cn";

export type Pose = "idle" | "think" | "happy" | "sad" | "cheer";

function Eyes({ cx, cy, pose }: { cx: number; cy: number; pose: Pose }) {
  if (pose === "happy" || pose === "cheer") {
    // ^ ^ smiling eyes
    return (
      <g stroke="var(--color-ink)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d={`M${cx - 6} ${cy + 1}q3 -4 6 0`} />
        <path d={`M${cx + 2} ${cy + 1}q3 -4 6 0`} />
      </g>
    );
  }
  const dy = pose === "think" ? -2 : pose === "sad" ? 1 : 0;
  return (
    <g fill="var(--color-ink)">
      <circle cx={cx - 3} cy={cy + dy} r="2.6" />
      <circle cx={cx + 5} cy={cy + dy} r="2.6" />
      <circle cx={cx - 2.2} cy={cy + dy - 0.9} r="0.8" fill="#fff" />
      <circle cx={cx + 5.8} cy={cy + dy - 0.9} r="0.8" fill="#fff" />
    </g>
  );
}

function Mouth({ cx, cy, pose }: { cx: number; cy: number; pose: Pose }) {
  const d =
    pose === "sad"
      ? `M${cx - 4} ${cy + 3}q4 -4 8 0`
      : pose === "think"
        ? `M${cx - 3} ${cy + 1}h6`
        : pose === "cheer"
          ? `M${cx - 5} ${cy - 1}q5 8 10 0z`
          : `M${cx - 4} ${cy}q4 4 8 0`;
  return (
    <path
      d={d}
      stroke="var(--color-ink)"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill={pose === "cheer" ? "var(--color-pinch)" : "none"}
    />
  );
}

/** One fingertip: a rounded capsule with a nail, eyes, mouth and blush. */
function Finger({
  x,
  rot,
  fill,
  pose,
  mirrored,
}: {
  x: number;
  rot: number;
  fill: string;
  pose: Pose;
  mirrored?: boolean;
}) {
  return (
    <g transform={`translate(${x} 18) rotate(${rot} 22 60)`}>
      {/* Die-cut sticker edge, then the finger itself. */}
      <rect x="2" y="6" width="40" height="78" rx="20" fill="#fff" stroke="#fff" strokeWidth="11" />
      <rect
        x="2"
        y="6"
        width="40"
        height="78"
        rx="20"
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth="3.5"
      />
      <rect x={mirrored ? 20 : 8} y="12" width="16" height="12" rx="6" fill="#fff" opacity=".75" />
      <Eyes cx={22} cy={40} pose={pose} />
      <Mouth cx={22} cy={52} pose={pose} />
      <ellipse cx="9" cy="48" rx="4" ry="2.6" fill="var(--color-pinch)" opacity=".45" />
      <ellipse cx="35" cy="48" rx="4" ry="2.6" fill="var(--color-pinch)" opacity=".45" />
    </g>
  );
}

export function Mascot({
  pose = "idle",
  size = 96,
  className,
  bob = true,
  label,
}: {
  pose?: Pose;
  size?: number;
  className?: string;
  bob?: boolean;
  label?: string;
}) {
  // Fingers lean in to "pinch" when happy/cheering; droop apart when sad.
  const lean = pose === "happy" || pose === "cheer" ? 14 : pose === "sad" ? -6 : 6;
  return (
    <span
      className={cn("inline-block", bob && pose !== "sad" && "animate-bob", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 120 112" width={size} height={(size * 112) / 120} className="overflow-visible drop-shadow-sticker">
        {pose === "cheer" ? (
          <g stroke="var(--color-pinch)" strokeWidth="4.5" strokeLinecap="round">
            <path d="M60 4v10M44 8l5 8M76 8l-5 8" />
          </g>
        ) : null}
        <Finger x={10} rot={lean} fill="var(--color-lime)" pose={pose} />
        <Finger x={66} rot={-lean} fill="var(--color-bubble)" pose={pose} mirrored />
      </svg>
    </span>
  );
}

/** Chutki talking: mascot + a speech bubble. Used for coaching and empty states. */
export function Coach({
  pose = "idle",
  children,
  className,
  size = 72,
}: {
  pose?: Pose;
  children: React.ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <Mascot pose={pose} size={size} className="shrink-0" />
      <div
        className={cn(
          // A chat sticker from Chutki: squared bottom-left corner points at her.
          "relative mb-3 rounded-[22px] rounded-bl-[6px] bg-surface px-4 py-3 text-[17px] leading-snug font-bold text-ink pop",
        )}
      >
        {children}
      </div>
    </div>
  );
}
