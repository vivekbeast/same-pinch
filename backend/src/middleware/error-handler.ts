import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "@shared";
import { AppError } from "../lib/errors.js";
import { log } from "./logger.js";

export const notFoundRoute = (): RequestHandler => () => {
  throw new AppError("NOT_FOUND");
};

/** Maps every error to `{ error: { code, requestId } }`. Never leaks messages or stacks. */
export const errorHandler = (): ErrorRequestHandler => (err, req, res, _next) => {
  let e: AppError;
  if (err instanceof AppError) e = err;
  else if (err instanceof z.ZodError) e = new AppError("INVALID_INPUT");
  else if (err?.type === "entity.parse.failed" || err?.type === "entity.too.large") e = new AppError("INVALID_INPUT");
  else {
    const cause = (err as { cause?: { message?: string; code?: string } })?.cause;
    log.error({ err, cause: cause?.message, sqlstate: cause?.code, requestId: req.id }, "unhandled error");
    e = new AppError("INTERNAL");
  }
  if (e.headers) for (const [k, v] of Object.entries(e.headers)) res.setHeader(k, v);
  res.status(e.status).json({ error: { code: e.code, requestId: req.id } });
};
