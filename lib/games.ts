import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '@/db'
import { games, gamePlayers, seasonRoster, opponents } from '@/db/schema'
import type { NewGame } from '@/db/schema'
import { logActivity } from '@/lib/activity'

/** Creates a game and auto-inserts GamePlayer rows for every rostered player. */
export async function createGameWithRoster(data: Omit<NewGame, 'id' | 'createdAt' | 'updatedAt'>) {
  const id = randomUUID()
  const now = new Date()

  await db.insert(games).values({
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  }).run()

  const roster = await db
    .select({ playerId: seasonRoster.playerId })
    .from(seasonRoster)
    .where(eq(seasonRoster.seasonId, data.seasonId))
    .all()

  for (const { playerId } of roster) {
    await db.insert(gamePlayers).values({
      gameId:     id,
      playerId,
      attendance: 'unknown',
    }).run()
  }

  const opponent = await db.select({ name: opponents.name })
    .from(opponents).where(eq(opponents.id, data.opponentId)).get()

  await logActivity({
    seasonId: data.seasonId,
    gameId:   id,
    eventType: 'game_added',
    payload: {
      opponentName: opponent?.name ?? '',
      date:         data.date,
      time:         data.time,
      location:     data.location,
      homeOrAway:   data.homeOrAway,
    },
  })

  return { id, ...data, createdAt: now, updatedAt: now }
}
