import type { users } from "./db/schema.js";

export type SessionUser = typeof users.$inferSelect;

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: SessionUser;
      sessionTokenHash?: string;
      deviceHash?: string;
      /** Parsed, validated input (Express 5's req.query is read-only, so validated values live here). */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}
