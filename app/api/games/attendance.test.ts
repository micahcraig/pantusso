import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','orderBy','update','set','insert','values','get','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','orderBy','update','set','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), asc: vi.fn(), inArray: vi.fn() }))
vi.mock('@/db/schema', () => ({ gamePlayers: {}, players: {}, games: {}, opponents: {}, activityLog: {} }))

import { GET, PATCH } from '@/app/api/games/[id]/attendance/route'

const session = { user: { id: 'u1', role: 'admin' } }

function makeGet(id: string) {
  return new Request(`http://localhost/api/games/${id}/attendance`)
}
function makePatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/games/${id}/attendance`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/games/[id]/attendance', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET(makeGet('g1'), { params: { id: 'g1' } })
    expect(res.status).toBe(401)
  })

  it('returns attendance rows ordered by player name', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const rows = [
      { id: 'gp1', playerId: 'p1', name: 'Alice', attendance: 'confirmed' },
      { id: 'gp2', playerId: 'p2', name: 'Bob',   attendance: 'unknown'   },
    ]
    mockDb.all.mockReturnValue(rows)
    const res = await GET(makeGet('g1'), { params: { id: 'g1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].name).toBe('Alice')
  })
})

describe('PATCH /api/games/[id]/attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockDb)
    mockDb.update.mockReturnValue(mockDb)
    mockDb.set.mockReturnValue(mockDb)
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
    mockDb.all.mockReturnValue([])  // default empty playerRows for logActivity name lookup
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(makePatch('g1', { updates: [] }), { params: { id: 'g1' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 when updates is empty', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await PATCH(makePatch('g1', { updates: [] }), { params: { id: 'g1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when updates is not an array', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const res = await PATCH(makePatch('g1', { updates: 'bad' }), { params: { id: 'g1' } })
    expect(res.status).toBe(400)
  })

  it('calls update for each player in updates', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue({ availabilitySetAt: null })
    mockDb.run.mockReturnValue(undefined)
    const updates = [
      { playerId: 'p1', attendance: 'confirmed' },
      { playerId: 'p2', attendance: 'out' },
    ]
    const res = await PATCH(makePatch('g1', { updates }), { params: { id: 'g1' } })
    expect(res.status).toBe(200)
    expect(mockDb.update).toHaveBeenCalledTimes(2)
  })

  it('preserves existing availabilitySetAt when already set', async () => {
    mockGetServerSession.mockResolvedValue(session)
    const existingDate = new Date('2026-04-01')
    mockDb.get.mockReturnValue({ availabilitySetAt: existingDate })
    mockDb.run.mockReturnValue(undefined)
    await PATCH(makePatch('g1', { updates: [{ playerId: 'p1', attendance: 'confirmed' }] }), { params: { id: 'g1' } })
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.availabilitySetAt).toEqual(existingDate)
  })

  it('sets availabilitySetAt to now when not previously set', async () => {
    mockGetServerSession.mockResolvedValue(session)
    mockDb.get.mockReturnValue({ availabilitySetAt: null })
    mockDb.run.mockReturnValue(undefined)
    const before = new Date()
    await PATCH(makePatch('g1', { updates: [{ playerId: 'p1', attendance: 'confirmed' }] }), { params: { id: 'g1' } })
    const after = new Date()
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.availabilitySetAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(setCall.availabilitySetAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})
