# SCREENS.md — every screen, end to end

Wireframes below show the **phone** layout (baseline 360 × 740). Tablet (md–lg) and desktop (xl+) layouts are separate designs, specified per screen in **RESPONSIVE.md §4** — never a stretched phone screen. Loading, empty, error, offline and 404 states follow **UX_STATES.md**.

Copy rule: one line under any title, two at most. The flow teaches; text confirms.

Routes (React Router):

```
/welcome            Onboarding (3 slides)
/welcome/language   Language pick
/                   Today
/play/:packId       Play (rounds)
/play/:packId/done  Results
/daily              Think Like India
/map                Sync Map
/wallet             Wallet (Earnings | Payouts)
/wallet/payout      Payout request
/pals               Pals & Leaderboard
/me                 Profile, level, badges
/settings           Settings
*                   404 — "That's a miss" (UX_STATES.md §5)
```

Navigation: bottom nav on phone, NavRail on tablet, Sidebar on desktop — visible on `/`, `/map`, `/wallet`, `/pals`, `/me`, `/settings`; hidden during play and onboarding.

---

## 1. Onboarding `/welcome`
*Inherits: RideLocker onboarding slides 1–3.*

```
┌────────────────────────────────┐
│ [🤏] Same Pinch        ( Skip )│  logo tile + wordmark, glass Skip pill
│                                │
│        full-bleed photo        │
│                                │
│ ┌────────────────────────────┐ │
│ │ [🤏] Same Pinch · now       │ │  Glass Card (notification mock)
│ │ You & Asha (Meghalaya)     │ │
│ │ both said "chai" 🤏         │ │
│ └────────────────────────────┘ │
│ Think alike.                   │  Hero 52px, white
│ Get paid.                      │
│ Match a stranger's word.       │  Body 17px, white/75
│ Earn for every match.          │
│ ● ━━ ●                         │  page dots
│ ╭────────── Next ───────────╮  │  white pill CTA, ink text
│     ⟲ I already play — restore │  text link
└────────────────────────────────┘
```

| Slide | Photo | Glass card | Headline | Sub |
|---|---|---|---|---|
| 1 | College canteen | Notification: "You & Asha (Meghalaya) both said *chai* 🤏" | Think alike. Get paid. | Match a stranger's word. Earn for every match. |
| 2 | Monsoon street | Three Bhasha Plates: `KN ನಾಯಿ` `HI कुत्ता` `EN dog` joined by a "= PINCH" badge | Same thought. Any language. | Kannada, Hindi or English — a match is a match. |
| 3 | Bus window, dusk | Mini Night card: "7 🔥 day flame · ₹24.50 this week" | 2 minutes a day. | Play 10 rounds. Keep your flame. Get paid fairly. |

- Swipe or Next. Last slide CTA = **Let's play**.
- Skip → language screen.
- Restore → enter 6-word recovery phrase or phone OTP (stretch). MVP: "Restore from code" with an 8-char code shown in Settings.

**States:** images loading → LQIP blur; offline first launch → still works (photos precached in the app shell).

## 2. Language `/welcome/language`
*Inherits: "Add your papers" list card.*

- Title "Pick your language" (and the same in 3 scripts underneath, small).
- One white card with 4 rows: icon tile with script glyph (`अ`, `ಅ`, `அ`, `A`), language name in its own script, English name in grey, radio on right.
- Below: "You can match words in **any** language. This is only for buttons and menus."
- CTA "Continue" (violet pill, fixed bottom). Calls `POST /api/v1/auth/anon` (HttpOnly session cookie), stores `ui_lang`.

## 3. Today `/`
*Inherits: RideLocker Today (both variants).*

```
Today                    (₹)(⚙)
Tuesday, 13 October

┌─ Gradient Feature Card ───────┐
│ [📅] Think Like India #142  [Play]│
│     Guess what India said      │
│ ( "Something you eat in rain?")│  glass suggestion pills (today's prompts preview)
│ ( "One word for Monday?" )     │
└───────────────────────────────┘

┌─ Night Hero Card ─────────────┐
│ 7   Day flame                  │  coral 96px numeral
│     Play today to keep it      │
│ (❄ 2 freezes) (₹ 24.50 week)   │  tinted chips
│ ╭──── Play 10 rounds → ─────╮  │  white pill
└───────────────────────────────┘

Today so far  6                    section + count
┌───────────────────────────────┐
│ [🤏] 6 pinches · 2 Bhasha  ₹3.40 >│ icon row
│ [⏱] 3 packs left today        >│
└───────────────────────────────┘

Your level                      See all
┌───────────────────────────────┐
│ Mind Reader · L3   ▓▓▓▓░░ 320/500│ progress bar violet
│ Next: Telepath                 │
└───────────────────────────────┘

New on your map  2              See all
 ┌──────────┐ ┌──────────┐        horizontal scroll cards
 │ Meghalaya│ │ Kerala   │
 │ 🟢 Synced│ │ 🟢 Synced│
 └──────────┘ └──────────┘
```

**States**
- *First visit:* Night card shows "0 · Start your flame" and CTA "Play your first 10"; level card hidden; map row replaced with "Pinch to light up India" teaser.
- *Played today:* Night card turns to "Flame safe ✓ for today", CTA "Play again (XP only)" if paid cap reached, else "Play another pack".
- *Daily done:* Gradient card shows the grid `🟩🟩🟨⬜🟩` + "Share".
- *Offline:* top-right icon becomes a cloud-off with "Offline" tooltip; a soft banner "You're offline. You can still play 2 saved packs."
- *Pending sync:* icon = cloud with spinner; "3 rounds waiting to send".
- *Loading:* skeletons in exact card shapes (no spinners).

## 4. Pre-play sheet (from Play FAB)
*Inherits: "Add papers" bottom sheet.*

- Drawer (vaul), grab handle, title "Ready to pinch?"
- **Dark hero row:** violet circle icon + "Duo · 10 rounds" + "About 2 minutes" + chevron → starts pack.
- Two soft tiles: "Think Like India · 5 words" and "Practice · XP only".
- Stepper: **1 See → 2 Drop → 3 Flip** (active step violet).
- Footnote with lock icon: "Paid only for checked matches."

## 5. Play `/play/:packId`
*New screen; uses system tokens.*

```
(✕)   ●●●●○○○○○○   3/10   ₹1.20     top bar: close, progress dots, counter, live earnings
┌───────────────────────────────┐
│                               │
│        prompt image           │  rounded-tile, 1:1
│                               │
└───────────────────────────────┘
Burnt: ~~dog~~ ~~animal~~            grey struck chips
What do you see?                    prompt line 20px

[ KN ಬೀದಿ ] [ EN sleepy ] [ + ]      Bhasha Plates for entered words
┌───────────────────────────────┐
│ Type a word…            (🎙)   │  input, mic button
└───────────────────────────────┘
       ◯ 14s                         timer ring
╭──────────── Drop ────────────╮     violet pill, disabled until 1 word
```

- Language of each word auto-detected by script; for Latin script, user can tap the plate strip to switch EN ↔ romanised HI/KN.
- Enter / comma adds a chip. Max 3. Tap chip to remove.
- Timer last 5 s: ring turns marigold (not red), gentle tick haptic each second (if enabled).

**Reveal (after Drop):**

1. Partner card slides up from below: avatar, "Asha · Meghalaya".
2. Both 3-word columns flip simultaneously (rotateY), 450 ms.
3. Match → matched plates scale and connect with an SVG line; **PINCH stamp** slams in; haptic `[30, 40, 60]`; `+₹0.50 · +10 XP` floats up.
4. Bhasha → stamp says **BHASHA PINCH** with a rainbow strip.
5. Miss → partner's words shown, soft wobble, "So close — next one!"
6. Auto-advance after 1.8 s, or tap "Next".

**Offline:** reveal step shows "Saved ✓ — we'll show the result when you're online" with a sealed-envelope card; game continues. Results screen later shows "3 waiting for result".

**Exit:** ✕ → confirm sheet "Leave now? Rounds you finished are saved."

## 6. Results `/play/:packId/done`
*Inherits: "Check papers" screen.*

```
←   Your pinches
┌─ Night Hero ──────────────────┐
│ [🤏] Pack done!                │
│ Every match was checked.       │
│ 6            4                 │  green-bright / grey big numbers
│ Pinched      Missed            │
└───────────────────────────────┘
Matches
┌───────────────────────────────┐
│ [img] Asha · Meghalaya        │
│       [EN chai] = [HI चाय]  ✓ Bhasha │
│       +₹0.75                  │
└───────────────────────────────┘ … one card per pinch
╭── ✓✓ Collect ₹3.40 · +140 XP ──╮   violet pill
```

After Collect: coins fly into the top-right wallet icon; flame increments with animation if first pack today; level bar fills; new badges pop one by one (sheet); new map regions toast.

## 7. Think Like India `/daily`
*Inherits: Ride AI empty state (icon + big question + 2×2 cards).*

- Header "Think Like India #142", sub "Same 5 for everyone today".
- One prompt at a time, big. One word input. "Lock it in".
- After 5: grid of 5 squares + per-prompt row "You: *chai* · India: *chai* 41% 🟩".
- Share button (Web Share API → fallback copy). Next challenge countdown "New in 9h 12m".

## 8. Sync Map `/map`
*Inherits: Garage (cards with status tiles).*

- Title "Map", sub "14 of 36 synced".
- India SVG map card (pinch-zoom disabled; tap region → sheet).
- Filter chips: All · Synced · Not yet.
- Region list grouped by zone (North, South…), each a card: region name, "Pinched 6 times", status tile (green *Synced* / grey dashed *Not yet* / coral-tinted *New!* for 24 h).
- Badge progress strip: "Explorer 5/5 ✓ · Bharat Synced 14/36".

## 9. Wallet `/wallet`
*Inherits: Manage (stat tiles + segmented + timeline) and challan rows.*

```
Wallet                         (↗)
Demo money — no real payouts yet     small warning-soft banner in prototype

[ Earnings 3 | Payouts 1 ]          segmented

┌──────┐┌──────┐┌──────┐
│₹62.40││₹10.00││₹50.00│              stat tiles
│Earned││Pending││Paid  │
└──────┘└──────┘└──────┘

Today
┌───────────────────────────────┐
│ 13   ● Pack · 6 pinches   +₹3.40 >│ day timeline
│ OCT  ● Pack · 4 pinches   +₹2.10 >│
└───────────────────────────────┘
Yesterday …
```

- Payouts tab: rows with status chips `Paid ✓` (green), `On the way` (warning), each with UPI masked `v***@okaxis`.
- Fair-pay card (Night): "How pay works — ₹0.50 per match, +₹0.25 Bhasha, × your accuracy (1.2×)."
- Empty state: icon tile + "Your first match adds money here."

## 10. Payout `/wallet/payout`
*Inherits: Ride AI download sheet (stats strip + one big CTA).*

- Sheet: "Send to UPI", input UPI ID (validated `^[\w.\-]{2,256}@[a-zA-Z]{2,64}$`), amount (min ₹50, max balance).
- Stats strip: "₹62.40 available · ₹0 fee · within 24 h".
- CTA "Send ₹50.00". Prototype: status moves to Paid after 60 s with a clear "Demo" tag.

## 11. Pals & Leaderboard `/pals`
- Segmented: **Leaderboard | Pals**.
- Leaderboard: filter chips City / State / India; your rank card pinned (Night style, coral rank numeral); list rows with avatar, handle, level tag, XP. "Resets Monday".
- Pals (stretch): Brain Twin cards "84% alike" with shared flame.

## 12. Profile `/me`
- Avatar, handle, level name, XP bar, flame, "Joined Oct 2026".
- Badges grid (3 columns, locked badges greyed with how-to text).
- "Brain Wrapped" card (stretch).

## 13. Settings `/settings`
*Inherits: Settings (Air-Gapped Vault hero + grouped toggles + "Your data").*

- **Fair Play Promise** Night hero: shield icon; "We pay for work, never for luck." Stats: `₹0` deposits ever · `₹50` minimum payout · `24 h` max wait (green-bright).
- **Play:** Language (value violet) · Sound effects (toggle) · Vibration (toggle) · Data saver (toggle: lower image quality, no audio autoplay).
- **Reminders:** Daily reminder (toggle) · Remind me at `8:00 PM` · Send a test reminder.
- **Keep it safe:** Your restore code · Back up progress now · Log out (keeps earnings server-side).
- **Your answers** (green checks): "Answers are used to teach computers Indian languages." · "We never show your exact city." · "No chats, no DMs, no strangers messaging you." · "Delete my account" link.
- Footer: version, Terms, Privacy, "How we pay".

## 14. Global states

| State | Pattern |
|---|---|
| Loading | Shape-matched skeletons, shimmer disabled on reduced motion |
| Empty | Icon tile + one line + one action |
| Error | Inline card: danger-soft, icon, plain text, "Try again" |
| Offline | Cloud-off icon in header + soft banner once per session |
| Toasts | `sonner` bottom-centre above nav, ink background, 2.5 s |
| Install prompt | After 2nd completed pack: sheet "Add Same Pinch to home screen — opens faster, works offline." |
