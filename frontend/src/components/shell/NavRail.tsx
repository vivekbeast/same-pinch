// Tablet + desktop (md+): a floating dark dock on the left — the same object as the phone's bottom dock,
// stood upright. Logo, the lime PLAY coin, then the four tabs. Pages get the rest of the width (D41).
import { NavLink } from "react-router";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { PlayFab } from "./BottomNav";
import { useNotes } from "@/lib/queries";
import { PRIMARY, type NavItem } from "./nav-items";

/** A small dot on People when a Pinch Note is waiting (D48). */
function UnreadDot() {
  const unread = useNotes().data?.unread ?? 0;
  if (!unread) return null;
  return <span aria-label={t("notes.unread")} className="absolute -top-0.5 right-2 size-2.5 rounded-full border-2 border-night bg-pinch" />;
}

function DockLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      data-tour={`tab-${item.to.slice(1) || "home"}`}
      className="flex w-full flex-col items-center gap-1 py-1.5 text-[12.5px]"
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "relative grid h-10 w-14 place-items-center rounded-full transition-colors",
              isActive ? "bg-lime text-ink" : "text-white/60 hover:bg-white/10 hover:text-white",
            )}
          >
            {item.to === "/people" ? <UnreadDot /> : null}
            <item.icon className="size-[22px]" strokeWidth={isActive ? 2.5 : 2} />
          </span>
          <span className={isActive ? "font-bold text-white" : "font-semibold text-white/60"}>{t(item.label)}</span>
        </>
      )}
    </NavLink>
  );
}

export default function NavRail() {
  return (
    <div className="sticky top-0 h-dvh shrink-0 p-3 md:p-3 lg:p-4 xl:p-5">
      <nav
        aria-label={t("nav.main")}
        className="pop flex h-full w-[92px] flex-col items-center gap-2 rounded-[30px] bg-night py-5 lg:w-[96px] xl:w-[100px]"
      >
        <Logo size={56} className="mb-1" />
        <PlayFab className="mb-3" />
        {PRIMARY.map((item) => (
          <DockLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}
