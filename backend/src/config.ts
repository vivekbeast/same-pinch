import { z } from "@shared";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  SESSION_PEPPER: z.string().min(32),
  DEVICE_PEPPER: z.string().min(32),
  JOBS_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  DEMO_MODE: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  SENTRY_DSN: z.string().optional(),
  // Where the web app lives: Google sign-in redirects back here. Defaults to the first allowed origin.
  APP_ORIGIN: z.url().optional(),
  // Stage 2 — Google sign-in (OAuth "Web application" client, authorization code + PKCE).
  // Offered only when all three are set. The secret never leaves the server.
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(10).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),
});

// Crash on boot if misconfigured. An empty value (`GOOGLE_CLIENT_ID=` in .env.example) means "not set", not
// "invalid", so a fresh clone boots with the optional features simply switched off.
const parsed = Env.parse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")));
export const env = { ...parsed, APP_ORIGIN: parsed.APP_ORIGIN ?? parsed.ALLOWED_ORIGINS[0] ?? "http://localhost:5173" };
export type Env = typeof env;
