# UI_DIRECTION.md — v3: Same Pinch is shared thinking

**Supersedes v1** (number plates, rubber stamps, Plate Map). Owner feedback on v1: it read like a vehicle
app, the game wasn't clear, navigation felt misleading, Play was buried behind a sheet, screens scrolled too
much, and nothing *felt* like a game. v3 changes the product hierarchy: Same Pinch brings people closer
through the way they think, rather than using play to drive reward collection.

## 1. What a first-time user must understand in 5 seconds

> **You and another person see the same picture. Type the first word you think of. If your thoughts meet,
> you have a SAME PINCH.**

Every primary screen serves that shared moment. The first screen puts the next round one tap away, not a
wallet, streak, level or reward counter.

## 2. Direction: Sticker Bomb

Gen-Z, funky, jolly: the app is a school-notebook page with stickers slapped on it. v2's black outlines,
hard offset shadows and violet-on-lavender read as a generic "playful app" template and are gone.

| Element | Choice | Why |
|---|---|---|
| Surface | Cool paper `canvas` with a sparse **doodle confetti** (squiggles, rings, zig-zags, plus signs) in faint brand colours (`body`) | Stickers need a surface; ruled grids and boxes read as template |
| Shapes | **Die-cut stickers**: white edge + soft lifted shadow (`pop`, `pop-sm`); decorative stickers tilt (`tilt-l`, `tilt-r`) and jiggle | Playful without the brutalist template |
| Buttons | **Jelly**: coloured bottom lip (`--lip`), glossy top, squish on press (`press`) | Tactile game feel, candy not concrete |
| Colour | Cobalt (brand), **lime = PLAY / matched**, tomato = the pinch + flame, bubblegum = Bhasha + stickers, sunny yellow = coins; navy ink | Loud and young; no purple, no gradients |
| Type | **Anek** (Ek Type) everywhere: one family drawn for Latin, Devanagari, Kannada, Tamil, Telugu. Headings/numbers at 112% width; weights capped at 700, body 450 | One systematic voice in every script a player types; light enough to read all day; Indian-made |
| Words | Chat-bubble stickers (one squared corner) with a language tag | Words are messages between two people |
| Mascot | **Chutki**: lime + bubblegum fingertip stickers, poses idle / think / happy / sad / cheer | Guides the practice game, reacts to rounds |
| The moment | Cards flip → a **"SAME PINCH!" starburst sticker slapped on** + confetti + shake; peels off after ~2 s | One loud, unmistakable celebration of two thoughts meeting |
| First run | Title card → 3 rounds: "ROUND n" sticker slap, partner "typing…", lock in, 3-2-1 countdown, reveal → summary | Feels like a game show from the first tap |

## 3. Structure

```
First run:  Practice game (3 rounds, Chutki coaching) → shared-moment summary → language + 18+ → Home + 3-step tour
Tabs:       Home · Daily · (big Play) · People · Me
Home:       next-round preview · giant PLAY · shared moments · Daily and people secondary
People:     who you matched with — podium + leaderboard (City / State / India)
Me:         you (avatar, level) + your stuff: Wallet · Badges · India map · Flame → each its own page; settings
After a pack: shared-moment summary → matched words and people → account/reward details remain secondary
```

Play is never more than one tap away: the Home hero, the centre nav button (both start instantly, no sheet),
and "Play again" on every result.

## 4. Product hierarchy rules

- The primary home screen must show the next playable shared experience before account metrics.
- Balances, XP, levels, streaks and paid-pack language belong in secondary account or reward surfaces.
- A match reveal celebrates the two words, their languages and the people behind them.
- Do not present placeholder history as real shared-moment activity; a future shared-moments feed must use
  real round data.
- Money and progression may continue to exist for product requirements, but they cannot be the reason to play
  or the dominant copy on the primary loop.

## 5. Rules kept from the rulebook

Say less (one line under a title) · no sparkle icons · reduced-motion respected (bursts fade, no shake) ·
48 px touch targets · tokens only in `theme.css` · offline play · first paint ≤ 150 KB.

## 6. Layout per device (D41)

- **Phone:** bottom dark dock with the lime PLAY coin. Screens are one column that fits; Play is one centred stack.
- **Tablet + desktop:** the same dark dock, upright and floating on the left. No sidebar, no right panel.
- **Desktop bentos:** Home = PLAY hero (7/12, full height) + shared moments stacked (5/12). Me = identity card
  pinned left (5/12) + "your stuff" 2×2 (7/12). People = podium + your rank pinned left, leaderboard right.
