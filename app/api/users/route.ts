import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const all = db.select({
    id: users.id, name: users.name, email: users.email,
    role: users.role, isActive: users.isActive, createdAt: users.createdAt,
  }).from(users).all()

  return NextResponse.json(all)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, email, password } = await req.json() as Record<string, string>
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  const user = {
    id:           randomUUID(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role:         'manager' as const,
    isActive:     true,
    createdAt:    new Date(),
    updatedAt:    new Date(),
  }

  db.insert(users).values(user).run()

  const { passwordHash: _omit, ...safe } = user
  return NextResponse.json(safe, { status: 201 })
}
