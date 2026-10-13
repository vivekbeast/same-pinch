// Toasts without paying for them on first paint: sonner loads after first render, and toasts raised
// before its <Toaster> has mounted wait for it instead of being lost.
type Sonner = typeof import("sonner");
type Opts = Parameters<Sonner["toast"]>[1];

let markReady: () => void;
const ready = new Promise<void>((r) => (markReady = r));
export const toasterMounted = () => markReady();

const show = (fn: (s: Sonner) => void) => {
  void Promise.all([import("sonner"), ready]).then(([s]) => fn(s));
};

type Msg = string;
export const toast = Object.assign((m: Msg, o?: Opts) => show((s) => s.toast(m, o)), {
  success: (m: Msg, o?: Opts) => show((s) => s.toast.success(m, o)),
  error: (m: Msg, o?: Opts) => show((s) => s.toast.error(m, o)),
});
