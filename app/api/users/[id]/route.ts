import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { eq } from 'drizzle-orm'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { UserRole } from '@/db/schema'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { name?: string; email?: string; role?: UserRole; isActive?: boolean }

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }
  if (body.name     !== undefined) updates.name     = body.name
  if (body.email    !== undefined) updates.email    = body.email
  if (body.role     !== undefined) updates.role     = body.role
  if (body.isActive !== undefined) updates.isActive = body.isActive

  await db.update(users).set(updates).where(eq(users.id, params.id)).run()

  return NextResponse.json({ ok: true })
}
