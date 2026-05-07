import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { opponents } from '@/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = await db.select().from(opponents).orderBy(asc(opponents.name)).all()
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, notes } = await req.json() as { name: string; notes?: string }
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const id = randomUUID()
  const now = new Date()
  await db.insert(opponents).values({
    id,
    name,
    notes: notes ?? null,
    createdAt: now,
    updatedAt: now,
  }).run()

  return NextResponse.json({ id, name, notes: notes ?? null, createdAt: now, updatedAt: now }, { status: 201 })
}
