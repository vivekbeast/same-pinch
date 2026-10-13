import { z } from "@shared";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.url(),
  SESSION_PEPPER: z.string().min(32),
  DEVICE_PEPPER: z.string().min(32),
  JOBS_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  DEMO_MODE: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  SENTRY_DSN: z.string().optional(),
});

// Crash on boot if misconfigured.
export const env = Env.parse(process.env);
export type Env = typeof env;
