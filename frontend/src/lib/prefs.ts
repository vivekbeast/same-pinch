// Device-side mirror of the player's play settings (from Me), readable anywhere without a query.
import { create } from "zustand";

export interface Prefs {
  sound: boolean;
  vibration: boolean;
  dataSaver: boolean;
}

/** Browser-level Data Saver also counts (docs/PERFORMANCE.md §3). */
const browserSaveData = () =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export const usePrefs = create<Prefs & { set: (p: Partial<Prefs>) => void }>((set) => ({
  sound: true,
  vibration: true,
  dataSaver: browserSaveData(),
  set: (p) => set(p),
}));

export const prefs = () => usePrefs.getState();

export function syncPrefs(settings: Record<string, unknown>) {
  usePrefs.getState().set({
    sound: settings.sound !== false,
    vibration: settings.vibration !== false,
    dataSaver: settings.dataSaver === true || browserSaveData(),
  });
}
