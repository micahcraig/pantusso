import { NextResponse } from 'next/server'
import { lookupPlayerByToken, getUpcomingGames, setAttendance } from '@/lib/availability'
import type { AttendanceStatus } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const player = lookupPlayerByToken(params.token)
  if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { seasonName, games } = getUpcomingGames(player.id)

  return NextResponse.json({
    player:     { id: player.id, name: player.name },
    seasonName,
    games,
  })
}

export async function PATCH(req: Request, { params }: { params: { token: string } }) {
  const player = lookupPlayerByToken(params.token)
  if (!player) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { updates } = await req.json() as {
    updates: Array<{ gameId: string; attendance: AttendanceStatus; note?: string | null }>
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
  }

  for (const { gameId, attendance, note } of updates) {
    setAttendance(gameId, player.id, attendance, note)
  }

  return NextResponse.json({ ok: true })
}
