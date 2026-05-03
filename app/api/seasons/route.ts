import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasons } from '@/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const all = await db.select().from(seasons).orderBy(desc(seasons.startDate)).all()
  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, startDate, endDate } = await req.json() as Record<string, string>
  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: 'name, startDate, and endDate are required' }, { status: 400 })
  }

  const id = randomUUID()
  const now = new Date()
  await db.insert(seasons).values({ id, name, startDate, endDate, createdAt: now, updatedAt: now }).run()

  return NextResponse.json({ id, name, startDate, endDate, createdAt: now, updatedAt: now }, { status: 201 })
}
