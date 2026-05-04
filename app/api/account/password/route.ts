import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword: string
    newPassword:     string
  }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  const user = await db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  await db.update(users)
    .set({ passwordHash: bcrypt.hashSync(newPassword, 10), updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .run()

  return NextResponse.json({ ok: true })
}
