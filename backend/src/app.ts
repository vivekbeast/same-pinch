import express from "express";
import { sql } from "./db/client.js";

// Skeleton only — the full middleware pipeline (docs/BACKEND.md §3) lands in the backend phase.
export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "8kb" }));

  app.get("/api/v1/health", async (_req, res) => {
    let db: "up" | "down" = "up";
    try {
      await sql`select 1`;
    } catch {
      db = "down";
    }
    res.status(db === "up" ? 200 : 503).json({ ok: db === "up", db, version: process.env.npm_package_version ?? "dev" });
  });

  return app;
}
