import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasonRoster, games, gamePlayers } from '@/db/schema'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; playerId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await db.delete(seasonRoster)
    .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, params.playerId)))
    .run()

  // Remove the player's pending (unknown) rows from scheduled games — preserves
  // confirmed/out/maybe rows so completed-game history stays intact.
  const scheduledGames = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.seasonId, params.id), eq(games.status, 'scheduled')))
    .all()

  const gameIds = scheduledGames.map(g => g.id)
  if (gameIds.length > 0) {
    await db.delete(gamePlayers)
      .where(and(
        inArray(gamePlayers.gameId, gameIds),
        eq(gamePlayers.playerId, params.playerId),
        eq(gamePlayers.attendance, 'unknown'),
      ))
      .run()
  }

  return NextResponse.json({ ok: true })
}
