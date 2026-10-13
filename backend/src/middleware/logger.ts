import { pinoHttp } from "pino-http";
import { pino } from "pino";
import { env } from "../config.js";

export const log = pino({
  level: process.env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug"),
  // Never log secrets or player content (AGENTS.md): cookies, words, UPI ids, restore codes.
  redact: {
    paths: [
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "req.headers.authorization",
      'req.headers["x-sp-device"]',
      "*.words",
      "*.word",
      "*.upi",
      "*.code",
      "*.restoreCode",
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { singleLine: true } } } : {}),
});

export const logger = () =>
  pinoHttp({
    logger: log,
    genReqId: (req) => (req as unknown as Express.Request).id,
    customProps: (req) => ({ userId: (req as unknown as Express.Request).user?.id }),
    serializers: {
      req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
  });
