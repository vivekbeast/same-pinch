import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler, notFoundRoute } from "./middleware/error-handler.js";
import { originGuard, requestId, security } from "./middleware/basics.js";
import { logger } from "./middleware/logger.js";
import { authRoutes } from "./routes/auth.routes.js";
import { gameRoutes } from "./routes/game.routes.js";
import { googleCallback, googleCallbackPath } from "./routes/google-callback.js";
import { jobRoutes, systemRoutes } from "./routes/system.routes.js";
import { requireUser, session } from "./services/session.service.js";

/** The request pipeline (docs/BACKEND.md §3). Order matters. */
export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind Vercel's proxy → correct req.ip

  app.use(requestId()); // X-Request-Id in/out
  app.use(logger()); // pino-http, redacts cookies, words, UPI, codes
  app.use(security()); // helmet + no-store
  app.use(express.json({ limit: "8kb" })); // tiny bodies only
  app.use(cookieParser());

  // Server-to-server jobs: bearer secret, no cookies, no origin check.
  app.use("/api/v1/jobs", jobRoutes);

  app.use(session()); // loads req.user from the sp_sid cookie (cached 60 s)
  app.use("/api", originGuard()); // non-GET: allowed Origin + X-SP-Client header

  app.get(googleCallbackPath(), googleCallback()); // OAuth redirect URI (Google console), GET → no origin check
  app.use("/api/v1", systemRoutes); // health, config
  app.use("/api/v1/auth", authRoutes);
  const GAME_PATHS = ["/me", "/packs", "/rounds", "/daily", "/wallet", "/map", "/leaderboard", "/people", "/notes", "/events"].map((p) => `/api/v1${p}`);
  app.use(GAME_PATHS, requireUser()); // signed-in only; unknown paths still fall through to 404
  app.use("/api/v1", gameRoutes);

  app.use(notFoundRoute()); // { error: { code: "NOT_FOUND" } }
  app.use(errorHandler()); // AppError → status + code; never leaks stacks
  return app;
}
