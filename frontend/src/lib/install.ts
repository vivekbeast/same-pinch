// "Add to home screen" (docs/SCREENS.md §14): offered once, after the 2nd collected pack.
import { create } from "zustand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

export const useInstall = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

const KEY = "sp.collected";
export function noteCollected() {
  try {
    const n = Number(localStorage.getItem(KEY) ?? 0) + 1;
    localStorage.setItem(KEY, String(n));
    if (n === 2 && deferred) useInstall.getState().setOpen(true);
  } catch {
    /* storage blocked: skip the offer */
  }
}

export async function promptInstall() {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome === "accepted";
}
