import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

import { requireSession, requireAdmin } from '@/lib/session'

const mockSession = (role: 'admin' | 'manager') => ({
  user: { id: 'u1', name: 'Test', email: 'test@example.com', role },
  expires: '2099-01-01',
})

describe('requireSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('redirects to /login when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await requireSession()
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('returns the session when authenticated', async () => {
    const session = mockSession('admin')
    vi.mocked(getServerSession).mockResolvedValue(session)
    const result = await requireSession()
    expect(result).toBe(session)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('returns the session for manager role too', async () => {
    const session = mockSession('manager')
    vi.mocked(getServerSession).mockResolvedValue(session)
    const result = await requireSession()
    expect(result).toBe(session)
  })
})

describe('requireAdmin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('redirects to /seasons for manager role', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('manager'))
    await requireAdmin()
    expect(redirect).toHaveBeenCalledWith('/seasons')
  })

  it('returns the session for admin role', async () => {
    const session = mockSession('admin')
    vi.mocked(getServerSession).mockResolvedValue(session)
    const result = await requireAdmin()
    expect(result).toBe(session)
  })

  it('does not redirect to /seasons for admin role', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession('admin'))
    await requireAdmin()
    expect(redirect).not.toHaveBeenCalledWith('/seasons')
  })
})
