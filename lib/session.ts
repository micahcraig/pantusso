import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from './auth'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireSession() {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}

export async function requireAdmin() {
  const session = await requireSession()
  if (session.user.role !== 'admin') redirect('/seasons')
  return session
}
