import type { Response } from "express";
import type { z } from "@shared";
import { env } from "../config.js";

/**
 * Send a JSON response that must match its shared contract. Outside production the body is parsed
 * against the schema first, so any drift (or a leaked field) fails tests loudly (docs/BACKEND.md §3).
 */
export function send<T extends z.ZodType>(res: Response, schema: T, data: z.input<T>, status = 200) {
  if (env.NODE_ENV !== "production") schema.parse(data);
  res.status(status).json(data);
}
