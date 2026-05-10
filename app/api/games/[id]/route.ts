import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { games, opponents } from '@/db/schema'
import type { GameStatus, HomeOrAway } from '@/db/schema'
import { logActivity } from '@/lib/activity'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    date?:          string
    time?:          string
    location?:      string
    homeOrAway?:    HomeOrAway
    opponentId?:    string
    status?:        GameStatus
    ourScore?:      number | null
    opponentScore?: number | null
  }

  const before = await db.select().from(games).where(eq(games.id, params.id)).get()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Partial<typeof games.$inferInsert> = { updatedAt: new Date() }
  if (body.date          !== undefined) updates.date          = body.date
  if (body.time          !== undefined) updates.time          = body.time
  if (body.location      !== undefined) updates.location      = body.location
  if (body.homeOrAway    !== undefined) updates.homeOrAway    = body.homeOrAway
  if (body.opponentId    !== undefined) updates.opponentId    = body.opponentId
  if (body.status        !== undefined) updates.status        = body.status
  if (body.ourScore      !== undefined) updates.ourScore      = body.ourScore
  if (body.opponentScore !== undefined) updates.opponentScore = body.opponentScore

  await db.update(games).set(updates).where(eq(games.id, params.id)).run()
  const updated = await db.select().from(games).where(eq(games.id, params.id)).get()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const opponent = await db.select({ name: opponents.name })
    .from(opponents).where(eq(opponents.id, updated.opponentId)).get()
  const opponentName = opponent?.name ?? ''

  if (body.status === 'cancelled' && before.status !== 'cancelled') {
    await logActivity({
      seasonId:  updated.seasonId,
      gameId:    updated.id,
      eventType: 'game_cancelled',
      payload:   { opponentName, gameDate: updated.date },
    })
  } else if (
    updated.status === 'completed' &&
    updated.ourScore !== null && updated.opponentScore !== null &&
    (body.ourScore !== undefined || body.opponentScore !== undefined || body.status === 'completed')
  ) {
    await logActivity({
      seasonId:  updated.seasonId,
      gameId:    updated.id,
      eventType: 'score_recorded',
      payload:   { opponentName, gameDate: updated.date, ourScore: updated.ourScore, opponentScore: updated.opponentScore },
    })
  }

  if (
    (body.date !== undefined || body.time !== undefined || body.location !== undefined) &&
    updated.status !== 'cancelled'
  ) {
    await logActivity({
      seasonId:  updated.seasonId,
      gameId:    updated.id,
      eventType: 'game_rescheduled',
      payload: {
        opponentName,
        gameDate:    updated.date,
        oldDate:     body.date     !== undefined ? before.date     : undefined,
        newDate:     body.date     !== undefined ? updated.date    : undefined,
        oldTime:     body.time     !== undefined ? before.time     : undefined,
        newTime:     body.time     !== undefined ? updated.time    : undefined,
        oldLocation: body.location !== undefined ? before.location : undefined,
        newLocation: body.location !== undefined ? updated.location : undefined,
      },
    })
  }

  return NextResponse.json(updated)
}
