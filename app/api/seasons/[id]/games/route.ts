import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq, asc } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { games, opponents } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({
      id:            games.id,
      date:          games.date,
      time:          games.time,
      location:      games.location,
      homeOrAway:    games.homeOrAway,
      status:        games.status,
      ourScore:      games.ourScore,
      opponentScore: games.opponentScore,
      opponentId:    games.opponentId,
      opponentName:  opponents.name,
    })
    .from(games)
    .innerJoin(opponents, eq(games.opponentId, opponents.id))
    .where(eq(games.seasonId, params.id))
    .orderBy(asc(games.date))
    .all()

  return NextResponse.json(rows)
}
