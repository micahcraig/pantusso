-- Backfill game_players rows for roster members added after games were created.
-- Safe to run multiple times — only inserts rows that are absent.
INSERT INTO game_players (id, game_id, player_id, attendance)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random()) % 4 + 1, 1) ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  g.id,
  sr.player_id,
  'unknown'
FROM season_roster sr
JOIN games g ON g.season_id = sr.season_id
LEFT JOIN game_players gp ON gp.game_id = g.id AND gp.player_id = sr.player_id
WHERE g.status != 'cancelled'
  AND gp.id IS NULL;
