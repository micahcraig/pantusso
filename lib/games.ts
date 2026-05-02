import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { games, gamePlayers, seasonRoster } from '@/db/schema'
import type { NewGame } from '@/db/schema'

/** Creates a game and auto-inserts GamePlayer rows for every rostered player. */
export function createGameWithRoster(data: Omit<NewGame, 'id' | 'createdAt' | 'updatedAt'>) {
  const game = db.insert(games).values({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning().get()

  const roster = db
    .select({ playerId: seasonRoster.playerId })
    .from(seasonRoster)
    .where(eq(seasonRoster.seasonId, data.seasonId))
    .all()

  for (const { playerId } of roster) {
    db.insert(gamePlayers).values({
      gameId:     game.id,
      playerId,
      attendance: 'unknown',
    }).run()
  }

  return game
}
