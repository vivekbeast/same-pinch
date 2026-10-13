# AGENTS.md — rules for anyone (human or AI) writing code here

Read this before touching code. When a rule here conflicts with a habit, this file wins.

## Non-negotiables

1. **Money is paid for work, never for winning.** No entry fees, no cash prizes, no luck-based cash, no ₹ loot boxes. Competition gives XP, badges, cosmetics only (GAME_DESIGN.md §0).
2. **The client never decides a match.** Partner words never reach the browser before the player's answer is stored. Scoring runs in the Express API (`POST /api/v1/rounds`) inside a DB transaction. The client only animates the result.
3. **Earned money never goes down** because of a broken streak, a lost duel, or a level change.
4. **Lighthouse ≥ 95 in Performance, Accessibility, Best Practices and SEO — on mobile and desktop.** Initial JS ≤ 150 KB gzip. Every PR adding a dependency states its gzip size. CI blocks regressions (PERFORMANCE.md).
5. **Offline first.** Play a pack, see flame and earnings history with the network off. Writes queue in IndexedDB.
6. **Say less.** One line under a title, two at most. All strings go through `t()`. No tours, no explainer modals (UX_STATES.md §1).
7. **No AI-slop UI.** Follow UX_STATES.md §2: no sparkle icons, no purple-pink gradients, glass only over photos, one gradient card in the app.

## Styling

- **One theme file:** all colours, fonts, radii, shadows, breakpoints and keyframes live in `frontend/src/styles/theme.css` (`@theme`). Components use tokens only (`bg-brand`, `text-ink-muted`, `rounded-card`, `font-display`). **No hex values, no font names, no raw shadows in components** — lint enforced.
- Tailwind only. No CSS-in-JS. Inline `style` only for Motion values and CSS variables.
- **Flex first**, grid for true 2-D layouts. Space siblings with `gap`, not margins.
- **Responsive sizing rule:** every width/height/padding/gap/text size on layout containers and components declares `base`, `sm:`, `md:`, `lg:`, `xl:` (RESPONSIVE.md R2). Use `min-h-dvh`, safe-area insets, `short:` for low-height screens.
- **Separate layouts per device family** (`{Screen}Phone|Tablet|Desktop.tsx`) when structure or behaviour differs; tablet/desktop layouts are lazy chunks. Never render two layouts and hide one with CSS.
- Variants via `cva`; merge with `cn()`.
- shadcn files in `components/ui/` are ours — rewrite them to the tokens; don't wrap them in another styled layer.
- Motion: `m.*` from `motion/react` inside `LazyMotion`; animate transform/opacity only; reduced-motion fallbacks required.
- Icons: `lucide-react`, imported individually.

## States (every screen)

Skeleton for first load (route-shaped, no full-screen spinner) · spinner only inside buttons/small areas · empty state (icon + one line + one action) · inline error with retry · offline banner · 404 for unknown routes (UX_STATES.md).

## Backend

- Express 5, layered: routes → controllers → services → Drizzle. Business rules live in services as pure, unit-tested functions.
- Validate every input with shared zod schemas. Return errors as `{ error: { code, requestId } }` only.
- Every user-scoped query filters by `req.user.id` (use the `mine()` helper). DTOs whitelist fields — never serialise gold flags, other users' IDs, or session data.
- Non-GET routes go through the origin guard and a rate limit.
- Money in paise (integers). Ledger is append-only.
- No secrets in the web app. API secrets only in Vercel env / GitHub secrets.

## Folder rules

- `frontend/src/features/<name>/` owns its hooks, layouts, components, route.
- `components/ui/` = primitives; `components/` = shared composites; `components/shell/` = BottomNav, NavRail, Sidebar, ContextPanel.
- `shared` = zod schemas, types, `normalize()`, `detectLang()` used by web and API.
- No feature imports another feature's internals.

## Before you open a PR

- [ ] `npm run lint && npm run typecheck && npm test` pass (root scripts run each package)
- [ ] Checked at 360×740, 768×1024 and 1366×768 (Responsively App or DevTools); no horizontal scroll
- [ ] Lighthouse mobile + desktop ≥ 95 on the screens you touched (local preview build)
- [ ] Works offline for anything you touched
- [ ] Loading, empty, error states present; no console errors
- [ ] New strings in all locale files (English fallback marked `// TODO translate`)
- [ ] No secrets, no logging of words, UPI or cookies
- [ ] Reduced-motion path checked
