import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "../config.js";

export const sql = postgres(env.DATABASE_URL, {
  max: 5, // small pool per instance; Neon's pooler fans in
  prepare: false, // required with PgBouncer transaction pooling
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(sql);
