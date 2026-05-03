import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { players } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { Position } from '@/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = await db.select().from(players).where(eq(players.isActive, true)).all()
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name: string
    jerseyNumber: string
    preferredPositions?: Position[]
    phone?: string
    email?: string
    whatsapp?: string
    notes?: string
  }

  if (!body.name || !body.jerseyNumber) {
    return NextResponse.json({ error: 'name and jerseyNumber are required' }, { status: 400 })
  }

  const id = randomUUID()
  const now = new Date()
  const player = {
    id,
    name:               body.name,
    jerseyNumber:       body.jerseyNumber,
    preferredPositions: body.preferredPositions ?? [] as Position[],
    phone:              body.phone    ?? null,
    email:              body.email    ?? null,
    whatsapp:           body.whatsapp ?? null,
    notes:              body.notes    ?? null,
    isActive:           true,
    createdAt:          now,
    updatedAt:          now,
  }

  await db.insert(players).values(player).run()

  return NextResponse.json(player, { status: 201 })
}
