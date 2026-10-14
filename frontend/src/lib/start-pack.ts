// One tap → playing (docs/UI_DIRECTION.md v2 §3): every Play button calls this; no sheet in between.
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { preload } from "@/app/screens";
import { api, ApiError } from "./api";
import { track } from "./events";
import { haptic } from "./haptics";
import { prefs } from "./prefs";
import { queryClient } from "./query";

/** A pack to play: a stored (prefetched) one first — it works offline — otherwise a fresh one. */
async function getPackToPlay() {
  const offline = await import("./offline");
  const stored = await offline.nextReadyPack();
  if (stored) return stored;
  if (!navigator.onLine) throw new ApiError("NETWORK", 0);
  const pack = await api("/packs", { method: "POST", schema: "Pack" });
  await offline.storePack(pack);
  void offline.warmAssets(pack, prefs().dataSaver);
  return pack;
}

export function usePackStarter() {
  const navigate = useNavigate();
  return useMutation({
    // The Play chunk downloads while the pack is fetched, not after.
    mutationFn: () => {
      preload("/play");
      return getPackToPlay();
    },
    onSuccess: (pack) => {
      track("pack_start");
      queryClient.setQueryData(["pack", pack.packId], pack);
      haptic.tap();
      navigate(`/play/${pack.packId}`);
    },
  });
}
