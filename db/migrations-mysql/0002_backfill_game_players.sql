-- Backfill game_players rows for roster members added after games were created.
-- Safe to run multiple times — only inserts rows that are absent.
INSERT INTO game_players (id, game_id, player_id, attendance)
SELECT UUID(), g.id, sr.player_id, 'unknown'
FROM season_roster sr
JOIN games g ON g.season_id = sr.season_id
LEFT JOIN game_players gp ON gp.game_id = g.id AND gp.player_id = sr.player_id
WHERE g.status != 'cancelled'
  AND gp.id IS NULL;
