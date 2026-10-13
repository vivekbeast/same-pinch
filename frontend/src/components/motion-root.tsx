// Motion lives only with the screens that animate (Welcome, Play, Results, Daily) — never in the first
// paint. `m.*` only (strict); reduced-motion follows the OS setting (docs/MOTION.md).
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Wrap a lazily loaded screen. */
export const withMotion =
  <P extends object>(Screen: (p: P) => ReactNode) =>
  (p: P) => (
    <MotionRoot>
      <Screen {...p} />
    </MotionRoot>
  );
