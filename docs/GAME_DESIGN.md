# GAME_DESIGN.md — mechanics, formulas, rules

All numbers here are defaults stored in a `game_config` table (see DATA_MODEL.md) so they can be tuned without a deploy.

---

## 0. Legal rule (read first)

India's Promotion and Regulation of Online Gaming Act, 2025 prohibits online money games: games with monetary stakes or cash/monetary-value prizes, whether skill or chance.

**Same Pinch is a paid micro-task with a game layer, not a money game.**

| Allowed | Not allowed |
|---|---|
| ₹ for each verified pinch (completed work) | Entry fees, deposits, "pay to play" |
| ₹ rate multiplier based on *accuracy on hidden test prompts* (work quality) | Cash for winning a duel, rank, or leaderboard |
| XP, levels, badges, cosmetics for competition | Random cash drops, spin wheels, scratch cards with ₹ |
| Cosmetic Golden Rounds | Buying anything with ₹ inside the app |

Every new feature PR must state which column it falls in. *(Design principle, not legal advice.)*

---

## 1. Core loop

```
Open app ─► Today ─► Play pack (10 rounds, ~2 min)
     ▲                    │
     │          See → Drop words → Flip → PINCH / miss
     │                    │
     │          Results: ₹ credited, XP, flame +1, states unlocked
     │                    │
     └──── Reminder (your time) ◄── Daily grid share ◄── Map / badges
```

## 2. A round

| Step | Rule |
|---|---|
| Prompt | One of: `image`, `sound`, `vibe` (mood question about an image), `question` ("Something you eat in the rain?") |
| Timer | 20 s (25 s for sound). Visible ring, no penalty colours until the last 5 s |
| Input | Up to **3 words** (chips). Type or Voice Drop. Each word 1–24 chars. |
| Submit | Auto at timer end if ≥ 1 word; otherwise round marked `skipped` (no XP, no ₹, no penalty) |
| Partner | A recorded answer set from another real player for the same prompt, chosen server-side |
| Reveal | Both cards flip together; matched words glow and connect with a line |

## 3. Matching

Matching runs **only on the server** in `POST /api/v1/rounds` (BACKEND.md §5).

1. **Normalise** each word: Unicode NFC → lowercase → trim → strip punctuation/emoji → collapse spaces → simple plural strip for English (`dogs`→`dog`).
2. **Map to concepts** via `lexicon(term, lang, concept_id)`. A term can map to several concepts. Romanised forms are separate rows (`naayi`, `nayi`, `ನಾಯಿ` → `c_dog`).
3. **Reject low-information words** (`thing`, `nice`, `good`, `ok`, `photo`, `picture`, `yes`, `no`, single letters). They never match.
4. **Reject burnt concepts** for that prompt (see §5).
5. **Match tiers**

| Tier | Condition | Points | Label in UI |
|---|---|---|---|
| Exact pinch | Same concept, same language | 10 XP | SAME PINCH! |
| Bhasha pinch | Same concept, different language | 15 XP | BHASHA PINCH! 🌈 |
| Near pinch | Concepts linked as `related` in `concept_edges` (puppy↔dog) | 4 XP, no ₹ | Almost pinched! |
| Miss | Nothing shared | 1 XP (participation) | So close — next one! |

A round counts as **one** pinch even if 2–3 words match. Extra matches add +2 XP each ("Double pinch!").

**Unknown words** (not in lexicon): exact string match after normalisation still counts as an Exact pinch. Unknown matched pairs go to `lexicon_candidates` for review — this is how the dictionary grows.

## 4. Recorded partners (async multiplayer)

- Every submitted answer set becomes a candidate partner for future players.
- Partner selection (server): same prompt, different user, not the same device fingerprint, not a flagged account, prefer answers from accounts with gold accuracy ≥ 75%, random among top 20.
- Seed data: every prompt ships with 5 seeded partner sets so the reviewer always has partners.
- The UI shows the partner as a real person: avatar, first name or handle, **state**. Never their exact city or anything identifying.

## 5. Burnt Words

For each prompt, once a concept appears in more than **40%** of the last 50 answer sets, it is **burnt** for that prompt.

- Burnt words are shown on the prompt card as struck-through chips: ~~dog~~ ~~animal~~.
- Typing a burnt word shows the chip in grey with a 🔥 and it is dropped from submission.
- Burning raises label specificity over time (ESP Game "taboo words").
- The reviewer demo ships with pre-burnt words on a few prompts so the mechanic is visible.

## 6. Session (pack)

- A pack = 10 rounds: 8 normal, 1 hidden gold (known answer), 1 vibe round. Order shuffled.
- Pack is downloaded whole (prompts + compressed assets + encrypted partner answers are **not** included — partner answers stay server-side). Offline play is handled by deferring the reveal; see ARCHITECTURE.md §Offline reveal.
- Session complete bonus: +20 XP.
- Max **5 paid packs per day** (daily cap protects data quality and prevents grinding). Extra play allowed for XP only.

## 7. Earnings (₹ — demo money in the prototype)

```
pinch_value      = base_rate (₹0.50) 
bhasha_bonus     = +₹0.25 when the pinch is Bhasha
quality_mult     = clamp(0.5, 1.5, 0.5 + gold_accuracy_30d)      // 0.0–1.0 accuracy
round_earning    = (pinch_value + bhasha_bonus) × quality_mult
daily_cap        = ₹40
```

- Near pinch and misses earn ₹0 (they aren't verified labels).
- Gold accuracy starts at 0.8 for new users so first-session pay feels fair.
- Credits are **instant** in the ledger as `credited`. Payout request moves an amount to `pending` → `paid` (simulated, 1 minute in the demo).
- Minimum payout: ₹50. No fees. No deposits ever.
- Balance never decreases except via a user-initiated payout. Fraud reversals (rare) appear as their own ledger line with a reason and an appeal link.

## 8. XP and levels

| Level | Name | XP needed | Unlocks |
|---|---|---|---|
| 1 | Stranger | 0 | Duo mode |
| 2 | Same Wave | 150 | Think Like India history |
| 3 | Mind Reader | 500 | Pinch Pals (stretch) |
| 4 | Telepath | 1,500 | Avatar frames |
| 5 | Pinch Oracle | 4,000 | Gold card style, "Oracle" tag on leaderboard |

Level-up shows a full-screen dark card with the new title (see MOTION.md §Level up).

## 9. Flame streak

- A day counts when the player finishes **at least 1 pack** before local midnight (Asia/Kolkata default; device timezone used).
- **Freeze:** earn 1 at day 7, then every 7 days. Hold max 2. Auto-used on a missed day.
- **Repair (grace):** if the streak broke yesterday and no freeze was left, finishing 2 packs today restores it once per 30 days.
- Milestones: 3, 7, 14, 30, 50, 100 days → badge + confetti.
- Streak **never** affects ₹.
- Reminder notification at the user's chosen time, only if they haven't played today. Max 1 per day. Copy is warm, never guilt: "Your flame is waiting 🔥 2 minutes is enough."

## 10. Think Like India (daily challenge)

- 5 prompts, same for everyone that day (IST date).
- Player gives **1 word** per prompt. Score per prompt vs. that prompt's all-time answer distribution:
  - 🟩 = top concept · 🟨 = in top 5 · ⬜ = otherwise
- Result screen shows "India said: chai (41%)".
- Share text (copy + Web Share API):

```
Same Pinch #142 🤏
🟩🟩🟨⬜🟩  4/5
samepinch.app
```

- Gives XP (5 per 🟩, 2 per 🟨), no ₹. Counts toward flame only if a pack is also played.

## 11. Sync Map

- India map with 36 regions (28 states + 8 UTs), simplified SVG (~25 KB gzip).
- A region lights up the first time you pinch with a partner from it.
- Colour intensity by pinch count (1, 5, 20+).
- Badges: 5 regions, 15 regions, all 36 ("Bharat Synced").

## 12. Leaderboard

- Weekly (Mon 00:00 IST reset), by **XP**, scoped to: your city · your state · India.
- Shows rank, avatar, handle, level, XP. Top 3 get cosmetic crowns for the next week.
- No ₹ prizes. Ever.

## 13. Badges (MVP set of 12)

| Badge | Condition |
|---|---|
| First Pinch | First match |
| Bhasha Bridge | First cross-language match |
| Double Pinch | 2 words matched in one round |
| Fire Starter | 3-day flame |
| Week of Flames | 7-day flame |
| Burnt Hunter | Pinch on a prompt with ≥ 3 burnt words |
| Sound Mind | 10 sound-round pinches |
| Vibe Twin | 10 vibe-round pinches |
| Explorer | 5 regions synced |
| Bharat Synced | All 36 regions |
| India Brain | 5/5 on Think Like India |
| Sharp Eye | 20 gold prompts correct in a row |

## 14. Stretch mechanics (spec only)

- **Pinch Pals:** after ≥ 3 pinches with the same recorded partner across sessions, offer to "Pinch Pal" them. Shared flame: both must play daily; shared freeze pool of 2.
- **Voice Drop:** hold mic, on-device Web Speech API where available → transcript chips the user confirms. Audio not uploaded in the MVP.
- **Brain Wrapped:** weekly card — top concepts, rarest pinch, most-synced state, flame. Rendered to PNG on device (canvas) for sharing.
- **Hive:** 4 recorded partners; score by matching the majority concept.
- **Golden Round:** 1-in-25 chance a round is golden; a pinch on it grants a cosmetic sticker. No ₹ change.

## 15. Anti-abuse (summary — details in SECURITY.md)

- Server-side scoring; partner answers never sent before submit.
- Hidden gold prompts → quality multiplier.
- Answer time < 800 ms on 3 rounds in a pack → pack flagged for review, earnings held as `pending_review`.
- Same answer across unrelated prompts (> 60% of pack) → flagged.
- Rate limits per user/device/IP; one paid account per device fingerprint.
