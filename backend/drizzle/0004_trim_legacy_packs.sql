-- D44: packs opened before D40 had 10 rounds. Trim every open pack to the new 5: drop rounds beyond the
-- 5th that haven't been answered. Answered rounds always stay (they're the player's work), so a pack
-- that was half-played keeps what was played and can still be collected.
DELETE FROM "pack_rounds" r
USING "packs" p
WHERE p."id" = r."pack_id"
  AND p."collected_at" IS NULL
  AND r."idx" >= 5
  AND NOT EXISTS (
    SELECT 1 FROM "answers" a WHERE a."pack_id" = r."pack_id" AND a."prompt_id" = r."prompt_id"
  );
