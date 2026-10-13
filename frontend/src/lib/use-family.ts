// Device family from the breakpoints in theme.css (docs/RESPONSIVE.md §3). Picks which navigation
// and which screen structure render — never two layouts hidden with CSS.
import { useSyncExternalStore } from "react";
import { BP } from "./breakpoints";

export type Family = "phone" | "tablet" | "desktop";

const qTablet = `(min-width: ${BP.md}px)`;
const qDesktop = `(min-width: ${BP.xl}px)`;

function read(): Family {
  if (matchMedia(qDesktop).matches) return "desktop";
  if (matchMedia(qTablet).matches) return "tablet";
  return "phone";
}

function subscribe(cb: () => void) {
  const a = matchMedia(qTablet);
  const b = matchMedia(qDesktop);
  a.addEventListener("change", cb);
  b.addEventListener("change", cb);
  return () => {
    a.removeEventListener("change", cb);
    b.removeEventListener("change", cb);
  };
}

export const useFamily = () => useSyncExternalStore(subscribe, read, (): Family => "phone");
