import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq, asc } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { gamePlayers, players } from '@/db/schema'
import type { AttendanceStatus } from '@/db/schema'

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

  for (const { playerId, attendance, note } of updates) {
    const existing = await db
      .select({ availabilitySetAt: gamePlayers.availabilitySetAt })
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
  }

  return NextResponse.json({ ok: true })
}
