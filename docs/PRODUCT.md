# PRODUCT.md — Same Pinch PRD

## 1. The brief

Build a small, responsive web app people want to open every day: they do a short task and are rewarded for it. Users are mostly on **modest Android phones and mobile data**, many read **English as a second language**, and what they earn is **worth real money** to them.

## 2. The idea in one line

Two strangers see the same prompt, each drop up to 3 words, and if any word means the same thing — in any Indian language — it's a **Same Pinch**: both earn, both level up, and they just discovered someone across India thinks like them.

## 3. Why this idea (research summary)

| Insight | Source | Design response |
|---|---|---|
| People underestimate how much strangers want to connect, and feel better after they do | Epley & Schroeder, *Mistakenly Seeking Solitude* (2014) | Connection through shared thinking, without the risk of meeting |
| Two strangers agreeing on a label is a reliable quality check | Luis von Ahn's ESP Game (2003), later licensed by Google | Agreement = verification = what we pay for |
| Streak retention gains are biggest in the first 7 days; freezes reduce churn | Duolingo retention team | Flame streak, freeze earned at day 7 |
| Rewards that feel controlling reduce motivation; rewards that signal competence help | Deci, Koestner & Ryan meta-analysis (1999) | Pay for work; reward the social side with recognition, not cash |
| Daily-ritual apps die of monotony (BeReal), live-only apps die of missed sessions (Clubhouse) | Apptopia/NYT; Clubhouse retention analyses | New prompts and themes daily; async play against recorded partners |
| "Earn money" apps in India lose trust over stuck withdrawals and deposit-to-withdraw tricks | Consumer complaint boards | Transparent ledger, no deposits ever, low payout threshold |
| India's 2025 online gaming law bans games with monetary stakes or cash prizes | Promotion and Regulation of Online Gaming Act, 2025 | ₹ only for completed work; competition gives XP/cosmetics |
| Gen Z uses ranking, streaks and small interest communities; is tired of "AI slop" | YPulse 2026; Beli | Human-only judgement, Brain Twin matching, shareable daily grid |

## 4. Users

**Primary — "Ritika", 21, Tier-2 city student.** Redmi phone with 3 GB RAM, ₹199 data pack, studies in Kannada and English. Wants pocket money and something fun on the bus.

**Secondary — "Arjun", 26, delivery rider.** Plays during waits. Prefers speaking to typing. Every ₹ counts; he needs to trust the payout.

**Reviewer — the hiring team.** Opens the link once on a laptop and once on a phone. Must see a full, alive experience in under 30 seconds with no other users online.

## 5. Constraints → requirements

| Constraint | Requirement |
|---|---|
| Modest Android | ≤ 150 KB initial JS (gzip), Lighthouse ≥ 95 in every category on mobile and desktop, 60 fps flip on low-end GPUs, no heavy UI kits |
| Mobile data | Prompt packs pre-fetched in one request (~150 KB/10 rounds), WebP images ~15 KB, Opus audio ~10 KB |
| Patchy network | Full offline play; queued submissions; clear "Saved, will sync" status |
| English as second language | Icon-first, short labels, voice input, UI in EN/HI/KN/TA, numbers over words |
| Real money | Clear ledger with reason per line, never-decreasing balance, instant crediting, honest "demo money" label in the prototype |

## 6. Scope

### MVP (must ship in 5 days)
1. Onboarding (3 slides) + language pick + anonymous start
2. **Duo session:** 10 rounds vs recorded partners, flip reveal, PINCH stamp
3. Bhasha Pinch across EN / HI / KN (TA if time)
4. Burnt Words
5. XP + levels, flame streak + freeze
6. Think Like India daily (5 prompts) + share grid
7. Earnings ledger (demo ₹) + payout request screen (simulated)
8. Sync Map (28 states + 8 UTs)
9. City leaderboard (weekly, XP)
10. Badges (12)
11. Settings: language, reminders, sound/haptics, data saver, Fair Play Promise

### Stretch
Pinch Pals with shared flame · Voice Drop · Brain Wrapped weekly card · Hive (4-player) mode · Golden Rounds (cosmetic)

### Out of scope (stated in README)
Real UPI payouts (needs KYC + payout partner), live real-time multiplayer, user-uploaded prompts, chat between users.

## 7. Success metrics (how we'd measure a real launch)

| Metric | Target |
|---|---|
| D1 / D7 retention | 40% / 20% |
| Sessions per DAU | ≥ 1.6 |
| Pinch rate (matched rounds) | 45–65% (too high = prompts too easy) |
| Gold accuracy (median) | ≥ 80% |
| Label cost per verified pinch | tracked vs. payout |
| Time to first pinch | < 45 s from first open |
| Crash-free sessions | ≥ 99.5% |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Collusion between friends | Server picks partners; never live friends in paid mode; anomaly flags |
| Low-effort answers ("thing") | Low-information word list scores 0; gold prompts lower pay multiplier |
| Cold start | Seeded recorded sessions for every prompt |
| Monotony | Daily themes, prompt types rotate (image / sound / vibe / question), Burnt Words raise difficulty |
| Legal reclassification as a money game | No stake, no entry fee, cash only for work; XP-only competition |
