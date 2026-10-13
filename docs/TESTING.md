# TESTING.md

## Pyramid

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | `normalize`, `detectLang`, money formatting, flame logic mirror, share text, zod schemas, play state machine transitions |
| Component | Vitest + Testing Library (jsdom) | BhashaPlate states, WordInput (max 3, burnt drop), Segmented keyboard nav, NightCard rendering |
| API | Vitest + supertest on `buildApp()` with a disposable Postgres (Docker locally, service container in CI) | Access control, validation, idempotency, flame/freeze edge cases, payout rules, CSRF guard, rate limits (SECURITY.md §8) |
| E2E | Playwright (Pixel 7, iPad Mini, Desktop 1366×768 projects) | Critical journeys below, offline mode, axe a11y |
| Performance | Lighthouse CI (mobile **and** desktop, median of 5) | ≥ 95 in all four categories (PERFORMANCE.md) |
| Responsive | Playwright projects `Pixel 7`, `iPad Mini`, `Desktop 1366×768` + screenshots | Correct layout family, no horizontal scroll (RESPONSIVE.md §5) |
| Manual device | Real low-end Android | Pre-release smoke |

## Critical E2E journeys

1. **First run:** open → 3 slides → language KN → Today shows "Play your first 10" → play pack (seeded) → see at least 1 PINCH → Collect → flame = 1, balance > 0.
2. **Bhasha pinch:** prompt with seeded partner answering `ನಾಯಿ`; type `dog` → "BHASHA PINCH!" visible; ledger line shows bonus.
3. **Burnt word:** type a burnt word → chip shows 🔥 and isn't submitted.
4. **Offline:** go offline mid-pack → submit 3 rounds → sealed cards → go online → toast "3 results are in" → results correct, no duplicates in ledger.
5. **Daily:** complete 5 → grid renders → share text copied.
6. **Payout (demo):** balance ≥ ₹50 → request → pending → paid after demo delay.
7. **Reduced motion:** `page.emulateMedia({ reducedMotion: "reduce" })` → no transforms on stamp; flow still works.
8. **Accessibility:** `@axe-core/playwright` on Today, Play, Results, Wallet, Settings → 0 serious/critical.
9. **404:** `/does-not-exist` shows "That's a miss" with Back to Today, has `noindex`.
10. **No console errors:** every journey asserts zero `console.error` / `pageerror` (protects Lighthouse Best Practices).
11. **Layout families:** at 1366×768 the Sidebar is visible and BottomNav is absent; at 768×1024 NavRail is visible; at 393×852 BottomNav is visible.

```ts
// tests/e2e/offline.spec.ts (sketch)
test("queues rounds offline and reveals later", async ({ page, context }) => {
  await page.goto("/?demo=1");   // API + web preview running
  await page.getByRole("button", { name: /play/i }).click();
  await page.getByRole("button", { name: /duo/i }).click();
  await context.setOffline(true);
  for (let i = 0; i < 3; i++) {
    await page.getByPlaceholder("Type a word…").fill("chai");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Drop" }).click();
    await expect(page.getByText(/we'll show the result/i)).toBeVisible();
    await page.getByRole("button", { name: /next/i }).click();
  }
  await context.setOffline(false);
  await expect(page.getByText(/results are in/i)).toBeVisible({ timeout: 15_000 });
});
```

## Unit examples

```ts
describe("normalize", () => {
  it("lowercases, strips punctuation and NFC-normalises", () => {
    expect(normalize("  Chai!! ")).toBe("chai");
  });
  it("keeps Kannada intact", () => {
    expect(normalize("ನಾಯಿ")).toBe("ನಾಯಿ");
  });
});
describe("flame", () => {
  it("uses a freeze after one missed day", () => {
    expect(nextFlame({ flame: 6, freezes: 1, last: "2026-10-11" }, "2026-10-13"))
      .toEqual({ flame: 7, freezes: 1 /* +1 at 7, -1 used */, freezeUsed: true });
  });
});
```

## Device matrix (manual, pre-submission)

| Device | Browser | Network | Pass criteria |
|---|---|---|---|
| Entry Android (2–3 GB RAM) | Chrome | Real 4G / throttled 3G | First pinch < 60 s from cold open; flip smooth |
| Mid Android | Chrome, Samsung Internet | Wi-Fi | Install PWA, offline play works |
| iPhone (any recent) | Safari | Wi-Fi | Layout + safe areas; no haptics (expected) |
| Laptop | Chrome, Firefox | Wi-Fi | Desktop layout (Sidebar + context panel); keyboard shortcuts in Play |

## CI gates

`lint` → `typecheck` → `migrate + seed (CI Postgres)` → `unit + API tests` → `build` → `size budget` → `e2e (3 viewports)` → `lighthouse mobile` → `lighthouse desktop` → `gitleaks` → Vercel preview.
