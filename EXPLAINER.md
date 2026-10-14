# Same Pinch — what I built, the choices I made, and what I left out

**▶ Video version (2:51):** [docs/media/same-pinch-explainer.mp4](docs/media/same-pinch-explainer.mp4) · **Live:** [samepinch.vercel.app](https://samepinch.vercel.app) (open it on a phone)

---

## 1. The idea

Same Pinch asks one question: **do two strangers notice the same thing?**

You see a photo and tap the first thing your eye goes to. Naming it is optional, up to three words, in any
language. A real player somewhere in India saw the same photo earlier. If you tapped the same spot, or your words
mean the same thing, that's a **Same Pinch**.

Each agreement is a small piece of verified data work: two people independently labelled the same image the
same way (the idea behind the ESP Game). So a verified match can pay a little money, while the game around it
(streaks, levels, badges) stays free of money.

A pack is five photos, about a minute.

## 2. What a reviewer should try (in this order)

1. **Open the link on a phone.** A ten-second story explains the game. Tap **Let's play**.
2. **Play the three practice rounds.** No sign-up. You play against recorded players and see their pins and
   words appear after yours.
3. **Sign up** (language, state, two checkboxes). A three-step tour points at Play, the daily challenge and Me.
4. **Play a real pack.** After each tap you see your partner's pin, a **heatmap of where everyone else
   pinched** ("40% pinched here too") and their words in their language.
5. **See your results.** The five rounds flip back as cards, XP fills, and your first flame appears.
6. **Try Daily** (Think Like India): five prompts, one word each, graded against everyone's answers.
7. **Turn the network off and keep playing.** Answers are saved and the reveal waits until you're back online.
8. **Open it on a laptop.** Desktop has its own layout with a curved navigation rail.

Want a player with history (wallet, badges, people)? On the welcome screen choose **I already play** and enter
the restore code **`SAME7777`**.

## 3. How it works

```text
 Phone (PWA)                         API (Express 5, Vercel · Singapore)        PostgreSQL (Neon · Singapore)
 ───────────                         ──────────────────────────────────         ─────────────────────────────
 React 19 · Tailwind · Motion  ──▶   validate (zod) → score the round      ──▶  answers, packs, ledger …
 packs cached in IndexedDB           inside one transaction:                    recorded answers become
 answers queued when offline   ◀──   pick a partner, match words,               future partners
                                     same-spot check, XP, ₹
```

- **The phone never decides a match.** Your answer is stored first; only then does the API pick a recorded
  partner, score the round and return their pin and words. Partner answers never reach the browser early.
- **Matching across languages.** Every word is normalised and mapped to a concept through a lexicon, so
  *ನಾಯಿ*, *naayi*, *कुत्ता* and *dog* all mean `dog`. Same concept in different languages is a **Bhasha Pinch**
  (pays a small bonus). Low-information words ("nice", "thing") never match. Concepts that most people say for
  a photo get **burnt**, so labels stay specific.
- **Recorded partners.** Every answer becomes a possible partner for the next player, so there's no waiting
  room and the game plays offline.

## 4. Choices I made, and why

| Choice | Why |
|---|---|
| **Tap first, words optional** | One thumb, about a minute a pack, and it works whatever language you think in. The tap is the game; words add the earning. |
| **Recorded partners, not live matchmaking** | No waiting for another player, works offline, and every answer adds to the pool. |
| **Money only for verified work** | India's Online Gaming Act (2025) bans money games. ₹ goes only to verified matches, scaled by accuracy on hidden test photos. Streaks, levels, the weekly board and the hot hand give XP and badges, never money. No deposits; earned money never goes down. |
| **Express + PostgreSQL, not Firebase** | Money needs real transactions and an append-only ledger in paise. |
| **Offline first** | Many players are on patchy mobile data. Packs download ahead; answers queue in IndexedDB and sync later. |
| **A strict weight budget** | ≤ 150 KB of JavaScript before first paint, enforced in CI (currently 143.8 KB). Animation uses only transform and opacity, with reduced-motion fallbacks. |
| **Separate phone, tablet and desktop layouts** | Each device gets a layout made for it, not one stretched screen. |
| **CSS 3D + Motion, not three.js** | three.js alone would use the whole JavaScript budget. |
| **No keep-warm ping** | The free database sleeps after five idle minutes. Because the game is offline-first, the 1–3 s wake-up only touches the first request after a quiet spell, and a ping every five minutes would have used up the free GitHub Actions minutes. |

Every settled trade-off is written down in [`docs/DECISIONS.md`](docs/DECISIONS.md) (56 decisions).

## 5. Measured, not promised

| | |
|---|---|
| Lighthouse, desktop | Performance **100**, Accessibility **100**, Best practices **100**, SEO **100** |
| Lighthouse, mobile (simulated slow 4G) | Performance **93**, Accessibility **100**, Best practices **100**, SEO **100** |
| JavaScript before first paint | **143.8 KB** gzip (budget 150) |
| Layout shift on the landing page | **0** |
| Automated tests | **145** (API and scoring against a real Postgres, game rules, shared helpers), run in CI on every push |

Lighthouse was run against the live site on the welcome page, the first thing a new visitor sees.

## 6. What I left out

- **Sound prompts and voice input.** Both are designed in [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) but not
  built. Every pack is photos.
- **Real UPI payouts.** They need KYC and a payout partner. The ledger, wallet and payout flow work end to end
  with demo money.
- **Live two-player rounds.** Recorded partners cover the async game; real-time play would need sockets and a
  matchmaking queue.
- **An admin tool** to review new cross-language word pairs the game discovers (they're collected in a table,
  but there's no UI yet).
- **Browser end-to-end tests and Lighthouse in CI.** CI runs lint, types, the 145 tests, the build and the
  bundle budget; the end-to-end checks in this write-up were run by hand.
- **More word languages in the UI.** Telugu and Marathi words match, but the interface is translated into four
  languages, not six.

## 7. Repository map

```text
frontend/   React web app — features/<screen>, components/, styles/theme.css, locales/
backend/    Express API — routes → services → Drizzle; migrations in backend/drizzle/
shared/     zod contracts and helpers used by both sides
docs/       product, game design, architecture, decisions; docs/media/ holds the videos
```

Setup, from clone to running: see the [README](README.md#run-it-locally).
