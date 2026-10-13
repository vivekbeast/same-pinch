import { defineConfig } from "tsup";

// Bundles the API plus ../shared (TS source, resolved through the @shared tsconfig path) into one ESM file.
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: ["@shared", "zod"],
});
