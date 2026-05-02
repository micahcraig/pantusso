import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasonRoster, players } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = db
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
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { playerId } = await req.json() as { playerId: string }
  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 })

  db.insert(seasonRoster).values({
    seasonId:  params.id,
    playerId,
    createdAt: new Date(),
  }).run()

  return NextResponse.json({ ok: true }, { status: 201 })
}
