import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','update','set','get','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','update','set']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({ players: { $inferInsert: {} } }))

import { PATCH } from '@/app/api/roster/[id]/route'

const session = { user: { id: 'u1', role: 'admin' } }

function makePatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/roster/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

describe('PATCH /api/roster/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockDb)
    mockDb.update.mockReturnValue(mockDb)
    mockDb.set.mockReturnValue(mockDb)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(makePatch('p1', { name: 'Alice' }), { params: { id: 'p1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when player not found', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue(undefined)
    const res = await PATCH(makePatch('p1', { name: 'Alice' }), { params: { id: 'p1' } })
    expect(res.status).toBe(404)
  })

  it('returns the updated player on success', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const updatedPlayer = { id: 'p1', name: 'Alice Updated', jerseyNumber: '7' }
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue(updatedPlayer)
    const res = await PATCH(makePatch('p1', { name: 'Alice Updated' }), { params: { id: 'p1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Alice Updated')
  })

  it('calls update with only provided fields', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue({ id: 'p1', isActive: false })
    await PATCH(makePatch('p1', { isActive: false }), { params: { id: 'p1' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.isActive).toBe(false)
    expect(setCall.name).toBeUndefined()
  })
})
