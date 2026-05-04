import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireSession = vi.hoisted(() => vi.fn())
vi.mock('@/lib/session', () => ({ requireSession: mockRequireSession }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','insert','values','delete','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','insert','values','delete']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({ lineupEntries: {} }))
vi.mock('@/components/lineup-editor-wrapper', () => ({}))

import { GET, PUT } from '@/app/api/games/[id]/lineup/route'

function makeGet(id: string) {
  return new Request(`http://localhost/api/games/${id}/lineup`)
}
function makePut(id: string, body: unknown) {
  return new Request(`http://localhost/api/games/${id}/lineup`, {
    method: 'PUT',
    body:   JSON.stringify(body),
  })
}

const entries = [
  { playerId: 'p1', battingOrder: 1, position: 'SS', lineupStatus: 'active' },
  { playerId: 'p2', battingOrder: 2, position: 'P',  lineupStatus: 'active' },
]

describe('GET /api/games/[id]/lineup', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('throws when session is required but missing', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(GET(makeGet('g1'), { params: { id: 'g1' } })).rejects.toThrow()
  })

  it('returns lineup entries', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'u1' } })
    mockDb.all.mockReturnValue(entries)
    const res = await GET(makeGet('g1'), { params: { id: 'g1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toHaveLength(2)
    expect(body.entries[0].playerId).toBe('p1')
  })
})

describe('PUT /api/games/[id]/lineup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.delete.mockReturnValue(mockDb)
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
  })

  it('throws when session is required but missing', async () => {
    mockRequireSession.mockRejectedValue(new Error('Unauthorized'))
    await expect(PUT(makePut('g1', { entries }), { params: { id: 'g1' } })).rejects.toThrow()
  })

  it('returns 400 for invalid request body', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'u1' } })
    const req = new Request('http://localhost/api/games/g1/lineup', {
      method: 'PUT',
      body:   'not json',
    })
    const res = await PUT(req, { params: { id: 'g1' } })
    expect(res.status).toBe(400)
  })

  it('deletes existing entries before inserting new ones', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'u1' } })
    mockDb.run.mockReturnValue(undefined)
    await PUT(makePut('g1', { entries }), { params: { id: 'g1' } })
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })

  it('does not insert when entries array is empty', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'u1' } })
    mockDb.run.mockReturnValue(undefined)
    await PUT(makePut('g1', { entries: [] }), { params: { id: 'g1' } })
    expect(mockDb.delete).toHaveBeenCalledTimes(1)
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('returns ok: true on success', async () => {
    mockRequireSession.mockResolvedValue({ user: { id: 'u1' } })
    mockDb.run.mockReturnValue(undefined)
    const res = await PUT(makePut('g1', { entries }), { params: { id: 'g1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
