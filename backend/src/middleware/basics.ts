// Small middleware: request id, security headers, validation, CSRF origin guard.
import { randomUUID } from "node:crypto";
import helmet from "helmet";
import type { RequestHandler } from "express";
import type { z } from "@shared";
import { env } from "../config.js";
import { AppError } from "../lib/errors.js";

const SAFE_ID = /^[\w-]{8,64}$/;

/** X-Request-Id in (if sane) and out; used in logs and error bodies. */
export const requestId = (): RequestHandler => (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.valid = {};
  res.setHeader("X-Request-Id", req.id);
  next();
};

/** API-safe headers: JSON only, so no CSP; never cache API responses (docs/SECURITY.md §4). */
export const security = (): RequestHandler[] => [
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-origin" } }),
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
];

type Schemas = { body?: z.ZodType; query?: z.ZodType; params?: z.ZodType };

/** Parse inputs with shared zod schemas; a ZodError becomes 422 INVALID_INPUT in the error handler. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    if (schemas.body) req.valid.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) req.valid.query = schemas.query.parse(req.query);
    if (schemas.params) req.valid.params = schemas.params.parse(req.params);
    next();
  };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie auth (docs/SECURITY.md T11): every state-changing request must come from an
 * allowed Origin AND carry `X-SP-Client: web`, a header cross-site forms cannot send.
 */
export const originGuard = (): RequestHandler => (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get("origin");
  if (!origin || !env.ALLOWED_ORIGINS.includes(origin) || req.get("x-sp-client") !== "web") {
    throw new AppError("FORBIDDEN");
  }
  next();
};
