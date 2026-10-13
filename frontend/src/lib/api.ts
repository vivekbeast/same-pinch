// Typed client for the Express API. Same origin (/api/v1, proxied in dev), cookie session.
// Responses are typed by their shared contract name; in development every response is also validated
// against the zod schema (that code — and zod — is stripped from the production bundle).
import type { api as Contract, ErrorCode, z } from "@shared";
import { deviceId } from "./device";

export const API = "/api/v1";

type Schemas = typeof Contract;
export type SchemaName = { [K in keyof Schemas]: Schemas[K] extends z.ZodType ? K : never }[keyof Schemas];
export type Out<K extends SchemaName> = z.infer<Schemas[K]>;

export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK";
  readonly status: number;
  readonly retryAfter?: number;
  constructor(code: ErrorCode | "NETWORK", status: number, retryAfter?: number) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal };

export function api<K extends SchemaName>(path: string, opts: Options & { schema: K }): Promise<Out<K>>;
export function api(path: string, opts?: Options): Promise<unknown>;
export async function api(path: string, opts: Options & { schema?: SchemaName } = {}): Promise<unknown> {
  const method = opts.method ?? "GET";
  let res: Response;
  try {
    res = await fetch(API + path, {
      method,
      credentials: "same-origin",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        "X-SP-Client": "web",
        "X-SP-Device": deviceId(),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("NETWORK", 0);
  }

  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) {
    const code = (data as { error?: { code?: ErrorCode } })?.error?.code ?? "INTERNAL";
    throw new ApiError(code, res.status, Number(res.headers.get("Retry-After")) || undefined);
  }
  if (import.meta.env.DEV && opts.schema) {
    const { api: contract } = await import("@shared");
    return (contract[opts.schema] as z.ZodType).parse(data);
  }
  return data;
}

/** Full-page navigations (OAuth start) — never fetch() these. */
export const googleStartUrl = (intent: "login" | "link", returnTo: string) =>
  `${API}/auth/google/start?intent=${intent}&returnTo=${encodeURIComponent(returnTo)}`;
