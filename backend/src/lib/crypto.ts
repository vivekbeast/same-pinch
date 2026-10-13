import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { RESTORE_CODE_ALPHABET, LIMITS } from "@shared";

/** Keyed hash for secrets at rest (session tokens, restore codes, device ids). Pepper never leaves the server. */
export const hashSecret = (value: string, pepper: string) => createHmac("sha256", pepper).update(value).digest("hex");

/** 32 random bytes, base64url — the session cookie value. */
export const newSessionToken = () => randomBytes(32).toString("base64url");

/** 8-char Crockford-style restore code (no 0/O/1/I), uniformly random. */
export const newRestoreCode = () =>
  Array.from({ length: LIMITS.restoreCodeLength }, () => RESTORE_CODE_ALPHABET[randomInt(RESTORE_CODE_ALPHABET.length)]).join("");

/** Deterministic UUID (v5-style layout) from a stable key, e.g. stableId("prompt:chai-glass"). */
export function stableId(key: string): string {
  const h = createHash("sha1").update(`samepinch:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50; // version 5
  h[8] = (h[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
