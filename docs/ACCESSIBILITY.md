# ACCESSIBILITY.md — WCAG 2.2 AA checklist

Accessibility here also means *language* accessibility: many users read English as a second language.

## Perceivable
- [ ] Text contrast ≥ 4.5:1 (large ≥ 3:1). Tokens are pre-checked (DESIGN_SYSTEM.md §2).
- [ ] Status never by colour alone: icon + word ("✓ Synced", "◌ Not yet").
- [ ] Prompt images have `alt` written as a neutral description **only for gold-free accessibility mode**; in normal play, `alt=""` with an accessible label "Picture prompt" (a full alt text would give away the answer). Sound prompts have a "Play again" button; deaf/hard-of-hearing users can turn off sound rounds in Settings (then they get image rounds instead, same pay).
- [ ] Text resizes to 200% without loss (use `rem`, no fixed heights on text containers).
- [ ] Indic fonts loaded when that language is selected; `lang` attribute set on `<html>` and on individual words in other scripts.

## Operable
- [ ] Touch targets ≥ 48×48 px; spacing ≥ 8 px.
- [ ] Every action reachable by keyboard (desktop reviewers): Tab order follows visual order, visible focus ring `ring-4 ring-brand/30`.
- [ ] Timer: Settings → "More time" doubles round time (WCAG 2.2.1 Timing Adjustable). Pay unaffected.
- [ ] No content flashes more than 3 times per second (confetti is a burst, not a strobe).
- [ ] Sheets: focus trapped, `Esc` closes, focus returns to trigger (Radix/vaul handle this; verify).
- [ ] Swipe gestures (onboarding) always have a button alternative.

## Understandable
- [ ] Plain language, short sentences, digits for numbers.
- [ ] Error messages say what happened and what to do.
- [ ] Consistent nav and labels across screens.
- [ ] Inputs have visible labels or `aria-label`; UPI field has format hint and example.

## Robust
- [ ] Radix primitives for tabs, switches, dialogs, toggle groups.
- [ ] Live regions: round result announced via `aria-live="polite"` ("Same pinch! You both said chai. Plus 50 paise.").
- [ ] Timer announces at 10 s and 5 s only (not every second).
- [ ] `eslint-plugin-jsx-a11y` in CI; axe checks in Playwright on every screen.

## Motion
- [ ] `prefers-reduced-motion`: all transforms off (MOTION.md fallback column), stamp fades in, no confetti.
- [ ] Haptics and sounds toggleable; off with Data Saver for sound.

## Testing
- TalkBack on Android Chrome: complete onboarding → one pack → collect.
- Keyboard-only on desktop Chrome: same flow.
- Zoom 200%: Today, Play, Wallet.
- `@axe-core/playwright` zero serious/critical violations.
