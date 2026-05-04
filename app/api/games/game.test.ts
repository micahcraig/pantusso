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
vi.mock('@/db/schema', () => ({ games: { $inferInsert: {} } }))

import { PATCH } from '@/app/api/games/[id]/route'

const session = { user: { id: 'u1', role: 'admin' } }

function makePatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/games/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

describe('PATCH /api/games/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockDb)
    mockDb.update.mockReturnValue(mockDb)
    mockDb.set.mockReturnValue(mockDb)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(makePatch('g1', { status: 'completed' }), { params: { id: 'g1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when game not found after update', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue(undefined)
    const res = await PATCH(makePatch('g1', { status: 'completed' }), { params: { id: 'g1' } })
    expect(res.status).toBe(404)
  })

  it('returns the updated game on success', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const game = { id: 'g1', status: 'completed', ourScore: 5, opponentScore: 3 }
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue(game)
    const res = await PATCH(makePatch('g1', { status: 'completed', ourScore: 5, opponentScore: 3 }), { params: { id: 'g1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('completed')
  })

  it('only updates provided fields', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue({ id: 'g1', location: 'New Field' })
    await PATCH(makePatch('g1', { location: 'New Field' }), { params: { id: 'g1' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.location).toBe('New Field')
    expect(setCall.date).toBeUndefined()
    expect(setCall.updatedAt).toBeInstanceOf(Date)
  })

  it('passes null scores through correctly', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.run.mockReturnValue(undefined)
    mockDb.get.mockReturnValue({ id: 'g1', ourScore: null })
    await PATCH(makePatch('g1', { ourScore: null }), { params: { id: 'g1' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.ourScore).toBeNull()
  })
})
