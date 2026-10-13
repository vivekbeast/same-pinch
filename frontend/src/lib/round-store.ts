// Per-pack round results kept in sessionStorage so Results can replay the stamps after a reload.
import type { api, z } from "@shared";

export interface StoredRound {
  promptId: string;
  kind: string;
  textKey: string;
  result: z.infer<typeof api.RoundResultResponse>;
}

const key = (packId: string) => `sp.rounds.${packId}`;

export function loadRoundResults(packId: string): (StoredRound | undefined)[] {
  try {
    return JSON.parse(sessionStorage.getItem(key(packId)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRoundResult(packId: string, index: number, r: StoredRound) {
  try {
    const all = loadRoundResults(packId);
    all[index] = r;
    sessionStorage.setItem(key(packId), JSON.stringify(all));
  } catch {
    /* storage blocked: Results falls back to the server summary */
  }
}
