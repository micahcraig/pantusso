import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['update','set','where','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['update','set','where']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({ users: { $inferInsert: {} } }))

import { PATCH } from '@/app/api/users/[id]/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

function makePatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/users/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

describe('PATCH /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.update.mockReturnValue(mockDb)
    mockDb.set.mockReturnValue(mockDb)
    mockDb.where.mockReturnValue(mockDb)
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(makePatch('u2', { isActive: false }), { params: { id: 'u2' } })
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await PATCH(makePatch('u2', { isActive: false }), { params: { id: 'u2' } })
    expect(res.status).toBe(403)
  })

  it('returns ok: true on success', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    const res = await PATCH(makePatch('u2', { isActive: false }), { params: { id: 'u2' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('only applies provided fields', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    await PATCH(makePatch('u2', { role: 'admin' }), { params: { id: 'u2' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.role).toBe('admin')
    expect(setCall.name).toBeUndefined()
    expect(setCall.email).toBeUndefined()
    expect(setCall.updatedAt).toBeInstanceOf(Date)
  })

  it('can set isActive to false', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    await PATCH(makePatch('u2', { isActive: false }), { params: { id: 'u2' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.isActive).toBe(false)
  })
})
