import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { players } from '@/db/schema'
import type { Position } from '@/db/schema'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    name?: string
    jerseyNumber?: string
    preferredPositions?: Position[]
    phone?: string | null
    email?: string | null
    whatsapp?: string | null
    notes?: string | null
    isActive?: boolean
    availabilityToken?: string
  }

  const updates: Partial<typeof players.$inferInsert> = { updatedAt: new Date() }
  if (body.name               !== undefined) updates.name               = body.name
  if (body.jerseyNumber       !== undefined) updates.jerseyNumber       = body.jerseyNumber
  if (body.preferredPositions !== undefined) updates.preferredPositions = body.preferredPositions
  if (body.phone              !== undefined) updates.phone              = body.phone
  if (body.email              !== undefined) updates.email              = body.email
  if (body.whatsapp           !== undefined) updates.whatsapp           = body.whatsapp
  if (body.notes              !== undefined) updates.notes              = body.notes
  if (body.isActive           !== undefined) updates.isActive           = body.isActive
  if (body.availabilityToken  !== undefined) updates.availabilityToken  = body.availabilityToken

  const updated = db.update(players).set(updates).where(eq(players.id, params.id)).returning().get()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(updated)
}
