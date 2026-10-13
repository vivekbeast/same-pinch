// Motion tokens (docs/MOTION.md). Only transform/opacity are animated.
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1] } as const;
export const dur = { xs: 0.12, sm: 0.2, md: 0.32, lg: 0.45 } as const;
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 38 },
  bouncy: { type: "spring", stiffness: 380, damping: 18 },
  soft: { type: "spring", stiffness: 220, damping: 26 },
  stamp: { type: "spring", stiffness: 520, damping: 16 },
} as const;
