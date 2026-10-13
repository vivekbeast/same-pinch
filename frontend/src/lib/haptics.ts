// Haptics (docs/MOTION.md). Android Chrome only; silently a no-op elsewhere. Respects the setting.
import { prefs } from "./prefs";

const buzz = (pattern: number | number[]) => {
  if (!prefs().vibration || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* blocked outside a user gesture — fine */
  }
};

export const haptic = {
  tap: () => buzz(8),
  tick: () => buzz(4),
  pinch: () => buzz([30, 40, 60]),
  miss: () => buzz(18),
  level: () => buzz([20, 30, 20, 30, 80]),
};
