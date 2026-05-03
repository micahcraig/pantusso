import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { and, eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasonRoster } from '@/db/schema'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; playerId: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(seasonRoster)
    .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, params.playerId)))
    .run()

  return NextResponse.json({ ok: true })
}
