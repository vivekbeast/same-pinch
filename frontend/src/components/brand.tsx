// Logo and the pinch glyph. Kept animation-free: the mark renders on every device family.
import { Mascot } from "@/components/mascot";

/** The two friendly pill characters from the Same Pinch mark. */
export function PinchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden>
      <g transform="rotate(9 17 25)">
        <rect x="5" y="3" width="24" height="43" rx="12" fill="var(--color-lime)" stroke="var(--color-surface)" strokeWidth="5" />
        <rect x="5" y="3" width="24" height="43" rx="12" fill="var(--color-lime)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <circle cx="12.5" cy="20" r="2" fill="var(--color-ink)" />
        <circle cx="21.5" cy="20" r="2" fill="var(--color-ink)" />
        <path d="M13 27c2.5 2.5 5.5 2.5 8 0" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 14l4 1M23 14l4-1" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g transform="rotate(-9 47 25)">
        <rect x="35" y="3" width="24" height="43" rx="12" fill="var(--color-bubble)" stroke="var(--color-surface)" strokeWidth="5" />
        <rect x="35" y="3" width="24" height="43" rx="12" fill="var(--color-bubble)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <circle cx="42.5" cy="20" r="2" fill="var(--color-ink)" />
        <circle cx="51.5" cy="20" r="2" fill="var(--color-ink)" />
        <path d="M43 27c2.5 2.5 5.5 2.5 8 0" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
        <path d="M37 14l4 1M53 14l4-1" fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** The logo IS the mascot: Chutki cheering. No tile, no box — the sticker stands on its own. */
export function Logo({ className, size = 48 }: { className?: string; size?: number }) {
  return <Mascot pose="cheer" size={size} bob={false} label="Same Pinch" className={className} />;
}
