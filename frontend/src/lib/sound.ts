// Three tiny synthesized sounds (docs/MOTION.md "Sound") — no audio files to download. One shared
// AudioContext, unlocked on the first user gesture; quiet (0.4); off with the setting or Data Saver.
import { prefs } from "./prefs";

let ctx: AudioContext | null = null;

function unlock() {
  if (ctx || typeof AudioContext === "undefined") return;
  ctx = new AudioContext();
}
if (typeof window !== "undefined")
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.4) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const allowed = () => {
  const p = prefs();
  if (!p.sound || p.dataSaver || !ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  return true;
};

export const sound = {
  /** Two-note "pop-pop". */
  pinch: () => allowed() && (tone(660, 0, 0.12), tone(990, 0.09, 0.16)),
  /** Soft low thud. */
  miss: () => allowed() && tone(170, 0, 0.18, "triangle", 0.25),
  /** Little rising arpeggio. */
  level: () => allowed() && [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.18)),
};
