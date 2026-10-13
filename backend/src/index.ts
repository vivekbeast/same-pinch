import { buildApp } from "./app.js";
import { env } from "./config.js";

const app = buildApp();
export default app;

// Vercel imports the default export; locally we listen.
if (!process.env.VERCEL && env.NODE_ENV !== "test") {
  app.listen(env.PORT, () => console.log(`api listening on http://localhost:${env.PORT}`));
}
