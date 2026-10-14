// Tablet + desktop (md+): a full-height dark rail, flush to the top, left and bottom edges, with big curved
// corners on the right (D54). The page "bites" a smooth curved notch into the rail's edge at the active tab,
// and a lime knob carrying that tab's icon sits in the notch, half out over the page. Changing tab slides
// notch + knob together on a springy curve (transform only); the icon lands with a little squash. Reduced
// motion: it simply jumps. Logo and PLAY at the top, the four tabs in the middle, Settings at the bottom.
import { Settings as SettingsIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router";
import { preload } from "@/app/screens";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { useNotes } from "@/lib/queries";
import { PlayFab } from "./BottomNav";
import { PRIMARY, type NavItem } from "./nav-items";

const SETTINGS: NavItem = { to: "/me/settings", label: "nav.settings", icon: SettingsIcon };
const ITEMS = [...PRIMARY, SETTINGS];

/** The tab that owns this path: the longest matching prefix ("/" only matches exactly). */
function activeIndex(path: string) {
  let best = -1;
  ITEMS.forEach((item, i) => {
    const hit = item.to === "/" ? path === "/" : path === item.to || path.startsWith(`${item.to}/`);
    if (hit && (best === -1 || item.to.length > ITEMS[best]!.to.length)) best = i;
  });
  return best;
}

/** A small dot on People when a Pinch Note is waiting (D48). */
function UnreadDot() {
  const unread = useNotes().data?.unread ?? 0;
  if (!unread) return null;
  return <span aria-label={t("notes.unread")} className="absolute -top-0.5 right-2 size-2.5 rounded-full border-2 border-night bg-pinch" />;
}

function DockLink({
  item,
  active,
  bubbleRef,
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  bubbleRef: (el: HTMLSpanElement | null) => void;
  compact?: boolean;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      data-tour={`tab-${item.to.slice(1) || "home"}`}
      onPointerEnter={() => preload(item.to)}
      onPointerDown={() => preload(item.to)}
      onFocus={() => preload(item.to)}
      aria-label={compact ? t(item.label) : undefined}
      className="group flex w-full flex-col items-center gap-1 py-1.5 text-[12.5px] focus-visible:outline-none"
    >
      {/* The active icon lives in the knob, so its own bubble steps aside. */}
      <span
        ref={bubbleRef}
        className={cn(
          "relative grid h-11 w-14 place-items-center rounded-full text-white/60 transition-opacity duration-200",
          "group-hover:bg-white/10 group-hover:text-white group-focus-visible:ring-4 group-focus-visible:ring-lime/60",
          active && "opacity-0",
        )}
      >
        {item.to === "/people" ? <UnreadDot /> : null}
        <item.icon className="size-[22px]" strokeWidth={2.25} aria-hidden />
      </span>
      {compact ? null : (
        <span className={cn("transition-colors", active ? "font-black text-white" : "font-semibold text-white/60")}>{t(item.label)}</span>
      )}
    </NavLink>
  );
}

export default function NavRail() {
  const { pathname } = useLocation();
  const active = activeIndex(pathname);
  const railRef = useRef<HTMLElement>(null);
  const bubbles = useRef<(HTMLSpanElement | null)[]>([]);
  const [y, setY] = useState<number | null>(null);
  const [ready, setReady] = useState(false); // no slide on first paint: the knob starts where it belongs

  const measure = useCallback(() => {
    const rail = railRef.current;
    const el = bubbles.current[active];
    if (!rail || !el) return setY(null);
    const r = rail.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setY(b.top - r.top + b.height / 2);
  }, [active]);

  useLayoutEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail) return;
    const ro = new ResizeObserver(measure);
    ro.observe(rail);
    const id = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(id);
    };
  }, [measure]);

  const Icon = active >= 0 ? ITEMS[active]!.icon : null;

  return (
    <div className="sticky top-0 z-30 h-dvh shrink-0">
      <nav
        ref={railRef}
        aria-label={t("nav.main")}
        className="relative flex h-full w-[96px] flex-col items-center gap-2 rounded-r-[44px] bg-night pt-6 pb-14 lg:w-[100px] xl:w-[104px]"
      >
        <Logo size={56} className="mb-1" />
        {/* Room below PLAY and above the rounded bottom corner, so the notch's shoulders never clip. */}
        <PlayFab className="mb-8" />

        <div className="flex w-full flex-1 flex-col items-center gap-1">
          {PRIMARY.map((item, i) => (
            <DockLink key={item.to} item={item} active={i === active} bubbleRef={(el) => (bubbles.current[i] = el)} />
          ))}
        </div>

        <DockLink
          item={SETTINGS}
          active={active === ITEMS.length - 1}
          bubbleRef={(el) => (bubbles.current[ITEMS.length - 1] = el)}
          compact
        />

        {/* The notch + knob. One group, moved with a transform; the page colour fills the notch. */}
        {y !== null && Icon ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 right-0 w-0 translate-y-(--knob-y)",
              ready && "transition-transform duration-500 ease-bounce motion-reduce:transition-none",
            )}
            style={{ "--knob-y": `${y}px` } as CSSProperties}
          >
            <svg className="absolute -top-16 right-0 h-32 w-[34px] fill-canvas" viewBox="0 0 34 128" preserveAspectRatio="none">
              {/* Tangent shoulders: the edge eases in, dips to the knob, eases back out. */}
              <path d="M34 0 C34 30 2 34 2 64 C2 94 34 98 34 128 Z" />
            </svg>
            <span className="pop absolute -top-7 -right-7 grid size-14 place-items-center rounded-full bg-lime text-ink ring-[6px] ring-canvas">
              <Icon key={active} className="size-6 animate-knob motion-reduce:animate-none" strokeWidth={2.75} />
            </span>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
