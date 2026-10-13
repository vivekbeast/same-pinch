import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/env";

const url = testDatabaseUrl(); // also loads .env for the peppers

export default defineConfig({
  resolve: { alias: { "@shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: url,
      ALLOWED_ORIGINS: "http://localhost:5173",
      DEMO_MODE: "true",
      // Placeholder Google client for tests — the code exchange is faked, the real secret is never used.
      APP_ORIGIN: "http://localhost:5173",
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
      GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
    },
  },
});
