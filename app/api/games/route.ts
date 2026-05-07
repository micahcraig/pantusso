import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createGameWithRoster } from '@/lib/games'
import type { HomeOrAway } from '@/db/schema'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    seasonId:   string
    opponentId: string
    date:       string
    time:       string
    location:   string
    homeOrAway: HomeOrAway
  }

  if (!body.seasonId || !body.opponentId || !body.date || !body.time || !body.location || !body.homeOrAway) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const game = await createGameWithRoster({
    seasonId:      body.seasonId,
    opponentId:    body.opponentId,
    date:          body.date,
    time:          body.time,
    location:      body.location,
    homeOrAway:    body.homeOrAway,
    ourScore:      null,
    opponentScore: null,
    status:        'scheduled',
  })

  return NextResponse.json(game, { status: 201 })
}
