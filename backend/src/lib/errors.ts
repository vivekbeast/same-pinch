import { ERROR_CODES, type ErrorCode } from "@shared";

/** Postgres SQLSTATE of a (possibly Drizzle-wrapped) database error, e.g. "23505" unique violation. */
export const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

/** The only error type services throw. The error handler turns it into `{ error: { code, requestId } }`. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly headers?: Record<string, string>,
  ) {
    super(message ?? code);
    this.status = ERROR_CODES[code];
  }
}
