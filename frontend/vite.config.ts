import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/*.png", "offline.html", "robots.txt"],
      manifest: {
        name: "Same Pinch",
        short_name: "Same Pinch",
        description: "Think alike. Any language. Get paid for every match.",
        theme_color: "#3D5AFE",
        background_color: "#EDF1FC",
        display: "standalone",
        start_url: "/",
        lang: "en-IN",
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
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/prompts/"),
            handler: "CacheFirst",
            options: { cacheName: "prompts", expiration: { maxEntries: 300, maxAgeSeconds: 2_592_000 } },
          },
          { urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "../shared/src/index.ts"),
    },
  },
  // Same-origin in dev too: the API runs on :3000 behind this proxy.
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000" },
    fs: { allow: [import.meta.dirname, path.resolve(import.meta.dirname, "../shared")] },
  },
  preview: { port: 4173, proxy: { "/api": "http://localhost:3000" } },
  build: { target: "es2022", cssCodeSplit: true, sourcemap: "hidden", modulePreload: { polyfill: false } },
});
