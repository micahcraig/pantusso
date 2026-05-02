import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { asc } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { opponents } from '@/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = db.select().from(opponents).orderBy(asc(opponents.name)).all()
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, notes } = await req.json() as { name: string; notes?: string }
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const opponent = db.insert(opponents).values({
    name,
    notes: notes ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning().get()

  return NextResponse.json(opponent, { status: 201 })
}
