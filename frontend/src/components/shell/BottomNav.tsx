// Phone only (base–sm): a floating dark dock — Home · Daily · (PLAY) · Rewards · Me. The lime centre button
// starts a pack at once, no sheet (docs/UI_DIRECTION.md v3). Solid fill, no blur: cheap on low-end GPUs.
import { NavLink } from "react-router";
import { preload } from "@/app/screens";
import { PinchGlyph } from "@/components/brand";
import { errorText } from "@/components/states";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { usePackStarter } from "@/lib/start-pack";
import { toast } from "@/lib/toast";
import { useNotes } from "@/lib/queries";
import { PRIMARY, type NavItem } from "./nav-items";

/** A small dot on People when a Pinch Note is waiting (D48). */
function UnreadDot() {
  const unread = useNotes().data?.unread ?? 0;
  if (!unread) return null;
  return <span aria-label={t("notes.unread")} className="absolute -top-0.5 right-2 size-2.5 rounded-full border-2 border-night bg-pinch" />;
}

function Tab({ item }: { item: NavItem }) {
  return (
    <li className="flex flex-1 justify-center">
      <NavLink
        to={item.to}
        end={item.to === "/"}
        data-tour={`tab-${item.to.slice(1) || "home"}`}
        onPointerDown={() => preload(item.to)}
        className="flex flex-col items-center gap-0.5 py-1"
      >
        {({ isActive }) => (
          <>
            <span
              className={cn(
                "relative grid h-8 w-12 place-items-center rounded-full transition-colors",
                isActive ? "bg-lime text-ink" : "text-white/60",
              )}
            >
              {item.to === "/people" ? <UnreadDot /> : null}
            <item.icon className="size-5" strokeWidth={isActive ? 2.75 : 2.25} />
            </span>
            <span className={cn("text-[12px]", isActive ? "font-black text-white" : "font-bold text-white/60")}>
              {t(item.label)}
            </span>
          </>
        )}
      </NavLink>
    </li>
  );
}

/** The lime PLAY coin. Lives in the dock (phone) and the rail (tablet). */
export function PlayFab({ className }: { className?: string }) {
  const start = usePackStarter();
  return (
    <button
      type="button"
      data-tour="play"
      onPointerEnter={() => preload("/play")}
      onPointerDown={() => preload("/play")}
      onClick={() => start.mutate(undefined, { onError: (e) => toast.error(errorText(e)) })}
      disabled={start.isPending}
      aria-label={t("nav.play")}
      className={cn(
        "pop press grid size-[66px] cursor-pointer place-items-center rounded-full bg-lime text-ink [--lip:var(--color-lime-600)]",
        className,
      )}
    >
      {start.isPending ? <Spinner className="size-7" /> : <PinchGlyph className="size-9" />}
    </button>
  );
}

export function BottomNav() {
  const [a, b, c, d] = PRIMARY;
  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(8px+env(safe-area-inset-bottom))] sm:px-4"
    >
      <ul className="pop mx-auto flex h-[66px] w-full max-w-[520px] items-center rounded-[26px] bg-night px-1">
        <Tab item={a!} />
        <Tab item={b!} />
        <li className="flex flex-1 justify-center">
          <PlayFab className="-mt-10" />
        </li>
        <Tab item={c!} />
        <Tab item={d!} />
      </ul>
    </nav>
  );
}
