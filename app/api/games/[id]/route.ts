import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { games } from '@/db/schema'
import type { GameStatus, HomeOrAway } from '@/db/schema'

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

  return NextResponse.json(updated)
}
