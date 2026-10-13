# PERFORMANCE.md — Lighthouse ≥ 95, everywhere, every time

## 1. The bar (strict)

| Category | Mobile | Desktop |
|---|---|---|
| Performance | **≥ 95** | **≥ 95** |
| Accessibility | **≥ 95** (target 100) | **≥ 95** (target 100) |
| Best Practices | **≥ 95** (target 100) | **≥ 95** (target 100) |
| SEO | **≥ 95** (target 100) | **≥ 95** (target 100) |

- Measured on the **production build** for: `/welcome`, `/` (Today, demo user), `/play/:id` (first round), `/wallet`, 404.
- Score = **median of 5 runs** (Lighthouse varies run to run). CI fails the PR if any median drops below 95.
- Recent Lighthouse versions no longer score a PWA category; installability is checked separately in DevTools → Application and in Playwright.

Supporting Core Web Vitals targets (mobile, Lighthouse simulated Slow 4G + 4× CPU):

| Metric | Target |
|---|---|
| FCP | ≤ 1.2 s |
| LCP | ≤ 1.8 s |
| TBT | ≤ 100 ms |
| CLS | ≤ 0.02 |
| Speed Index | ≤ 2.0 s |
| INP (field, p75) | ≤ 200 ms |

## 2. Budgets (CI-enforced)

| Asset | Budget (gzip/br) |
|---|---|
| Initial JS | ≤ 150 KB |
| Initial CSS | ≤ 18 KB |
| Fonts above the fold | ≤ 75 KB (2 preloaded files) |
| Initial HTML | ≤ 6 KB (includes inline app shell) |
| Requests before interactive | ≤ 12 |
| Largest image on first screen | ≤ 45 KB (onboarding photo), ≤ 18 KB (prompt) |
| 10-round pack (data + assets) | ≤ 200 KB |
| DOM nodes per screen | ≤ 800 |
| Main-thread long tasks on load | none > 50 ms after FCP |

## 3. How we hit 95+ on a phone

### Loading
1. **Static app shell in `index.html`** (inline CSS < 2 KB): logo, page title text, card placeholders. FCP/LCP happen before JS executes; React takes over seamlessly.
2. **Route-level splitting**; tablet/desktop layouts are separate chunks; Sentry, Map SVG, confetti, sound decoding load on idle/demand.
3. **No render-blocking third parties.** No Google Fonts, no analytics scripts, no chat widgets. Everything self-hosted.
4. **Preload** the 2 critical font files and the first prompt image of a stored pack; `fetchpriority="high"` on the LCP image only.
5. Modulepreload for the Today chunk (Vite does this automatically for static imports).
6. **Compression & caching:** Vercel serves Brotli; hashed assets `Cache-Control: public, max-age=31536000, immutable`; `index.html` and `sw.js` `no-cache`.
7. **HTTP/2 + one origin:** API on the same origin → no extra DNS/TLS for `/api`.
8. The service worker makes repeat visits instant (precache) — but scores are measured on first load, so steps 1–7 must stand alone.

### Rendering
- Animate only `transform`/`opacity`; ≤ 8 simultaneously animated elements.
- `backdrop-filter` at most once per screen; none under Data Saver.
- Long lists use `content-visibility: auto` with `contain-intrinsic-size`.
- No layout-shifting content: every image/media box has width/height or `aspect-*`; skeletons match final size; fonts use metric-matched fallbacks.
- Avoid heavy shadows on many scrolled elements.
- Break up work > 50 ms with `scheduler.yield()` / `setTimeout` chunking (e.g., building the map).

### Images & media
- WebP via `srcset`/`sizes` per breakpoint (RESPONSIVE.md R7), `loading="lazy"` below the fold, `decoding="async"`.
- Audio: Opus 24 kbps, preload only the next round.
- Data Saver (`navigator.connection.saveData` or toggle): smaller images, no autoplay audio, no onboarding photos.

### Accessibility & SEO points Lighthouse checks
- `<html lang>`, `<title>`, `<meta name="description">`, `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (never disable zoom).
- Valid `robots.txt`, canonical link, crawlable `<a href>` navigation (NavLink renders anchors).
- Unique accessible names for icon buttons, labelled inputs, sufficient contrast (tokens pre-checked), logical heading order, `tap targets` ≥ 48 px on touch.
- 404 page returns `noindex` meta.

### Best Practices points
- HTTPS only, HSTS, strict CSP, no mixed content.
- **No console errors or warnings** in production (CI checks the console in Playwright).
- No deprecated APIs, no `document.write`, images with correct aspect ratio and adequate resolution.
- `Permissions-Policy` set; no unload handlers.

## 4. Build config

```ts
// frontend/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "offline.html", "robots.txt"],
      manifest: {
        name: "Same Pinch", short_name: "Same Pinch",
        description: "Think alike. Any language. Get paid for every match.",
        theme_color: "#5A3BE7", background_color: "#F7F4EF",
        display: "standalone", start_url: "/", lang: "en-IN",
        icons: [
          { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,woff2,svg}", "onboarding/*-480.webp", "sounds/*.webm"],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith("/prompts/"), handler: "CacheFirst",
            options: { cacheName: "prompts", expiration: { maxEntries: 300, maxAgeSeconds: 2592000 } } },
          { urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { proxy: { "/api": "http://localhost:3001" } },     // same-origin in dev too
  build: { target: "es2020", cssCodeSplit: true, sourcemap: "hidden", modulePreload: { polyfill: false } },
});
```

## 5. Measuring

```bash
npm run build --prefix frontend && npm run preview --prefix frontend
npx lighthouse http://localhost:4173/ --preset=perf --form-factor=mobile --screenEmulation.mobile --view
npx lighthouse http://localhost:4173/ --preset=desktop --view
```

- **PageSpeed Insights** (pagespeed.web.dev) on the deployed URL — both Mobile and Desktop tabs.
- **WebPageTest** for filmstrips on a real mid-range Android profile.
- Real device: `chrome://inspect` on a low-end Android, Performance panel trace of one full round.
- Field data: `web-vitals` (~2 KB, loaded on idle) → `POST /events` `vitals`, sampled 20%.

## 6. Lighthouse CI (both form factors)

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "startServerCommand": "npm run preview --prefix frontend",
      "url": ["http://localhost:4173/welcome", "http://localhost:4173/?demo=1", "http://localhost:4173/wallet?demo=1", "http://localhost:4173/missing-page"],
      "numberOfRuns": 5,
      "settings": { "preset": "perf" }
    },
    "assert": {
      "aggregationMethod": "median",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.95 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "categories:best-practices": ["error", { "minScore": 0.95 }],
        "categories:seo": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "total-blocking-time": ["error", { "maxNumericValue": 100 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.02 }]
      }
    }
  }
}
```
Run it twice in CI: once with the mobile default and once with `--collect.settings.preset=desktop` (`lighthouserc.desktop.json`).

## 7. If a score dips below 95 — levers in order

1. Find the LCP element; make sure it's in the static shell or preloaded.
2. Check the bundle report (`rollup-plugin-visualizer`); move anything not needed for the first screen behind `lazy()`.
3. Remove/defer third-party code.
4. Reduce font files (drop a weight).
5. Check main-thread long tasks in the trace; chunk them.
6. Last resort: swap React for Preact via `preact/compat` alias (saves ~40 KB) — test Radix and Motion thoroughly first.
