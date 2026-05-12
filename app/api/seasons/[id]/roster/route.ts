import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasonRoster, players, games, gamePlayers } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      playerId:      players.id,
      name:          players.name,
      jerseyNumber:  players.jerseyNumber,
      preferredPositions: players.preferredPositions,
      isActive:      players.isActive,
      addedAt:       seasonRoster.createdAt,
    })
    .from(seasonRoster)
    .innerJoin(players, eq(seasonRoster.playerId, players.id))
    .where(eq(seasonRoster.seasonId, params.id))
    .all()

  return NextResponse.json(rows)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { playerId } = await req.json() as { playerId: string }
  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 })

  await db.insert(seasonRoster).values({
    seasonId:  params.id,
    playerId,
    createdAt: new Date(),
  }).run()

  // Back-fill game_players for any games already scheduled in this season.
  const seasonGames = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.seasonId, params.id), ne(games.status, 'cancelled')))
    .all()

  for (const { id: gameId } of seasonGames) {
    await db.insert(gamePlayers).values({ gameId, playerId, attendance: 'unknown' }).run()
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { playerId?: string; inRoster?: boolean }
  const { playerId, inRoster } = body
  if (!playerId || typeof inRoster !== 'boolean') {
    return NextResponse.json({ error: 'playerId and inRoster are required' }, { status: 400 })
  }

  // Upcoming games = scheduled only (don't touch completed game history)
  const scheduledGames = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.seasonId, params.id), eq(games.status, 'scheduled')))
    .all()
  const scheduledIds = scheduledGames.map(g => g.id)

  if (inRoster) {
    const existing = await db
      .select({ playerId: seasonRoster.playerId })
      .from(seasonRoster)
      .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, playerId)))
      .get()
    if (!existing) {
      await db.insert(seasonRoster).values({ seasonId: params.id, playerId, createdAt: new Date() }).run()
    }
    if (scheduledIds.length > 0) {
      const alreadyIn = new Set(
        (await db.select({ gameId: gamePlayers.gameId })
          .from(gamePlayers)
          .where(and(inArray(gamePlayers.gameId, scheduledIds), eq(gamePlayers.playerId, playerId)))
          .all())
          .map(r => r.gameId)
      )
      for (const gameId of scheduledIds) {
        if (!alreadyIn.has(gameId)) {
          await db.insert(gamePlayers).values({ gameId, playerId, attendance: 'unknown' }).run()
        }
      }
    }
  } else {
    await db.delete(seasonRoster)
      .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, playerId)))
      .run()
    if (scheduledIds.length > 0) {
      await db.delete(gamePlayers)
        .where(and(inArray(gamePlayers.gameId, scheduledIds), eq(gamePlayers.playerId, playerId)))
        .run()
    }
  }

  return NextResponse.json({ ok: true })
}
