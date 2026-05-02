import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { lineupEntries } from '@/db/schema'
import type { Position, LineupStatus } from '@/components/lineup-editor-wrapper'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireSession()

  const entries = db
    .select({
      playerId:     lineupEntries.playerId,
      battingOrder: lineupEntries.battingOrder,
      position:     lineupEntries.position,
      lineupStatus: lineupEntries.lineupStatus,
    })
    .from(lineupEntries)
    .where(eq(lineupEntries.gameId, params.id))
    .all()

  return NextResponse.json({ entries })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  await requireSession()

  let entries: Array<{
    playerId:     string
    battingOrder: number | null
    position:     Position | null
    lineupStatus: LineupStatus
  }>
  try {
    ;({ entries } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  db.delete(lineupEntries).where(eq(lineupEntries.gameId, params.id)).run()

  if (entries.length > 0) {
    db.insert(lineupEntries).values(
      entries.map(e => ({
        gameId:       params.id,
        playerId:     e.playerId,
        battingOrder: e.battingOrder ?? undefined,
        position:     e.position ?? undefined,
        lineupStatus: e.lineupStatus,
      }))
    ).run()
  }

  return NextResponse.json({ ok: true })
}
