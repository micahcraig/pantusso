import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, asc, inArray } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { gamePlayers, players, games, opponents } from '@/db/schema'
import type { AttendanceStatus } from '@/db/schema'
import { logActivity } from '@/lib/activity'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id:                    gamePlayers.id,
      playerId:              players.id,
      name:                  players.name,
      jerseyNumber:          players.jerseyNumber,
      preferredPositions:    players.preferredPositions,
      attendance:            gamePlayers.attendance,
      availabilitySetAt:     gamePlayers.availabilitySetAt,
      availabilityUpdatedAt: gamePlayers.availabilityUpdatedAt,
    })
    .from(gamePlayers)
    .innerJoin(players, eq(gamePlayers.playerId, players.id))
    .where(eq(gamePlayers.gameId, params.id))
    .orderBy(asc(players.name))
    .all()

  return NextResponse.json(rows)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { updates } = await req.json() as {
    updates: Array<{ playerId: string; attendance?: AttendanceStatus; note?: string | null }>
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
  }

  const now = new Date()

  const [gameInfo, playerRows] = await Promise.all([
    db.select({ seasonId: games.seasonId, date: games.date, opponentName: opponents.name })
      .from(games)
      .innerJoin(opponents, eq(games.opponentId, opponents.id))
      .where(eq(games.id, params.id))
      .get(),
    db.select({ id: players.id, name: players.name })
      .from(players)
      .where(inArray(players.id, updates.map(u => u.playerId)))
      .all(),
  ])
  const playerNameMap = new Map(playerRows.map(p => [p.id, p.name]))

  for (const { playerId, attendance, note } of updates) {
    const existing = await db
      .select({ attendance: gamePlayers.attendance, availabilitySetAt: gamePlayers.availabilitySetAt })
      .from(gamePlayers)
      .where(and(eq(gamePlayers.gameId, params.id), eq(gamePlayers.playerId, playerId)))
      .get()

    await db.update(gamePlayers)
      .set({
        ...(attendance !== undefined ? { attendance } : {}),
        ...(note       !== undefined ? { note }       : {}),
        availabilitySetAt:     existing?.availabilitySetAt ?? now,
        availabilityUpdatedAt: now,
      })
      .where(and(eq(gamePlayers.gameId, params.id), eq(gamePlayers.playerId, playerId)))
      .run()

    if (attendance !== undefined && gameInfo && attendance !== existing?.attendance) {
      await logActivity({
        seasonId:  gameInfo.seasonId,
        gameId:    params.id,
        playerId,
        eventType: 'attendance_updated',
        payload: {
          playerName:   playerNameMap.get(playerId) ?? '',
          gameDate:     gameInfo.date,
          opponentName: gameInfo.opponentName,
          status:       attendance,
          prevStatus:   existing?.attendance ?? null,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
