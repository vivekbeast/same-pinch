# MOTION.md — animation & haptics

Library: **Motion** (formerly Framer Motion), package `motion`, imported from `motion/react`.

```tsx
// src/app/providers.tsx
import { LazyMotion, domAnimation, MotionConfig } from "motion/react";
<LazyMotion features={domAnimation} strict>
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
</LazyMotion>
```

- Use `m.div` (not `motion.div`) everywhere — `strict` enforces it and keeps the initial bundle small (~5 KB instead of ~34 KB).
- `layoutId` / `layout` animations need `domMax`; load it lazily only on screens that use shared layout (segmented pill, page dots): `const loadFeatures = () => import("./max").then(r => r.default)` and `<LazyMotion features={loadFeatures}>`.
- Animate only `transform` and `opacity`. Never width/height/top/left (exception: PageDots width, 3 tiny elements).
- `MotionConfig reducedMotion="user"` turns transforms off for users with reduced motion; add explicit fallbacks below.

## Tokens

```ts
// src/lib/motion.ts
export const ease = { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1] } as const;
export const dur = { xs: 0.12, sm: 0.2, md: 0.32, lg: 0.45 } as const;
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 38 },
  bouncy: { type: "spring", stiffness: 380, damping: 18 },
  soft:   { type: "spring", stiffness: 220, damping: 26 },
} as const;
```

## Catalogue

| # | Moment | Spec | Reduced motion |
|---|---|---|---|
| 1 | Screen enter | `opacity 0→1, y 12→0`, dur.md, ease.out | opacity only |
| 2 | Card list stagger | children `staggerChildren: 0.04`, max 6 animated, rest instant | none |
| 3 | Press feedback | `whileTap={{ scale: 0.97 }}` spring.snappy (buttons, rows, FAB) | none |
| 4 | Onboarding slide | photo crossfade 400 ms + headline `y 24→0` delayed 80 ms; glass card `y 40→0, scale .96→1` spring.soft | crossfade only |
| 5 | Page dots | active width 10→32 spring.snappy | instant |
| 6 | Segmented pill | `layoutId="seg-pill"` spring.snappy | instant |
| 7 | Sheet | vaul native drag; content fade in 160 ms | — |
| 8 | Word chip add | `scale .6→1, opacity 0→1` spring.bouncy; remove `scale→.6, opacity→0` 120 ms | opacity |
| 9 | Timer ring | `pathLength 1→0` linear over round; at 5 s colour → `marigold` (never red/coral — red raises avoidance under pressure) + scale pulse 1→1.06 each second | colour only |
| 10 | **Flip reveal** | see below | crossfade 200 ms |
| 11 | **PINCH stamp** | see below | static stamp fade |
| 12 | Match line | SVG path `pathLength 0→1` 300 ms ease.out between matched plates | appear instantly |
| 13 | Reward float | `+₹0.50` text `y 0→-40, opacity 1→0` 900 ms | fade |
| 14 | Coins to wallet | on Collect: 6 marigold coin dots fly along a bezier to the header wallet icon (staggered 50 ms, 600 ms each), wallet icon bump `scale 1→1.15→1` | number ticks only |
| 15 | Number tick | `useMotionValue` + `animate(count, to, {duration: .8})`, render rounded | jump to value |
| 16 | Flame +1 | numeral `y 0→-100%` old / `100%→0` new (odometer), flame icon wiggle `rotate [-8,8,-4,0]` | swap |
| 17 | Level up | full-screen Night overlay, title `scale .8→1` spring.bouncy, ring of 12 confetti dots radial burst | overlay fade |
| 18 | Badge unlock | sheet with badge `rotateY 180→0` + `scale .5→1` | fade |
| 19 | Miss | partner card `x [0,-6,6,-3,0]` 300 ms | none |
| 20 | Skeleton | shimmer gradient translateX loop 1.4 s | static |

### 10. Flip reveal (the money shot)

```tsx
<div className="[perspective:900px]">
  <m.div
    className="relative [transform-style:preserve-3d]"
    initial={false}
    animate={{ rotateY: revealed ? 180 : 0 }}
    transition={{ duration: 0.45, ease: ease.inOut }}
  >
    <Face className="[backface-visibility:hidden]">…sealed…</Face>
    <Face className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">…words…</Face>
  </m.div>
</div>
```

- Your column and the partner column flip **at the same time** (same `transition`), after a 250 ms "drumroll" where both sealed cards gently `scale 1→1.02` twice.
- After flip completes (`onAnimationComplete`): matched plates pulse (`scale 1→1.12→1`, ring coral) → match line draws → stamp.

### 11. PINCH stamp

```tsx
<m.div
  initial={{ scale: 2.4, opacity: 0, rotate: -18 }}
  animate={{ scale: 1, opacity: 1, rotate: -6 }}
  transition={{ type: "spring", stiffness: 520, damping: 16 }}
  className="pointer-events-none absolute inset-x-0 top-1/3 mx-auto w-fit …"
>SAME PINCH!</m.div>
```

- At impact frame (~120 ms): whole play card `scale 1→0.985→1` ("squeeze"), and haptic fires.
- Bhasha variant: a 4 px rainbow strip (`bg-gradient-to-r from-lang-hi via-lang-kn to-lang-en`) wipes in under the text (`scaleX 0→1`, origin left).
- Stays 900 ms then `opacity→0, y→-20`.

## Haptics

```ts
// src/lib/haptics.ts
const can = typeof navigator !== "undefined" && "vibrate" in navigator;
export const haptic = {
  tap:   () => can && settings.vibration && navigator.vibrate(8),
  tick:  () => can && settings.vibration && navigator.vibrate(4),
  pinch: () => can && settings.vibration && navigator.vibrate([30, 40, 60]),
  miss:  () => can && settings.vibration && navigator.vibrate(18),
  level: () => can && settings.vibration && navigator.vibrate([20, 30, 20, 30, 80]),
};
```
`navigator.vibrate` works on Android Chrome; silently no-op on iOS Safari. Only call inside a user gesture chain.

## Sound

- Three tiny sounds, Opus in WebM + AAC fallback, each < 8 KB: `pinch.webm` (two-note "pop-pop"), `miss.webm` (soft thud), `level.webm`.
- Play via a single shared `AudioContext` created on first user gesture; decode once, cache buffers.
- Off by default when Data Saver is on. Respect device silent mode implicitly (can't detect; keep volume low, 0.4).

## Performance rules

- Never animate more than 8 elements simultaneously on Play.
- Confetti = 12 absolutely-positioned dots with transforms, not canvas particles.
- Test the flip at CPU 6× slowdown: must hold ≥ 50 fps. If not, drop the drumroll and match-line.
- `will-change: transform` only during the animation (Motion handles this).
