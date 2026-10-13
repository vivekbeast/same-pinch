// A random per-install id sent as X-SP-Device (a fraud signal, not a fingerprint — docs/SECURITY.md §6).
const KEY = "sp.device";
let memo: string | null = null;

export function deviceId(): string {
  if (memo) return memo;
  try {
    memo = localStorage.getItem(KEY);
    if (!memo) {
      memo = crypto.randomUUID();
      localStorage.setItem(KEY, memo);
    }
  } catch {
    memo = crypto.randomUUID(); // private mode: per-session id is fine
  }
  return memo;
}
