import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','insert','values','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), ne: vi.fn() }))
vi.mock('@/db/schema', () => ({ seasonRoster: {}, players: {}, games: {}, gamePlayers: {} }))

import { GET, POST } from '@/app/api/seasons/[id]/roster/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

function makePost(id: string, body: unknown) {
  return new Request(`http://localhost/api/seasons/${id}/roster`, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/seasons/[id]/roster', () => {
  beforeEach(() => { vi.clearAllMocks(); mockDb.select.mockReturnValue(mockDb) })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(res.status).toBe(401)
  })

  it('returns roster rows joined with players', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const rows = [
      { playerId: 'p1', name: 'Alice', jerseyNumber: '7', preferredPositions: [], isActive: true },
    ]
    mockDb.all.mockReturnValue(rows)
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Alice')
  })

  it('allows manager to view roster', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.all.mockReturnValue([])
    const res = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(res.status).toBe(200)
  })
})

describe('POST /api/seasons/[id]/roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
    mockDb.select.mockReturnValue(mockDb)
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(403)
  })

  it('returns 403 for manager role', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(403)
  })

  it('returns 400 when playerId is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost('s1', {}), { params: { id: 's1' } })
    expect(res.status).toBe(400)
  })

  it('inserts roster entry and returns 201', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([]) // no existing games to backfill
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('backfills game_players for existing non-cancelled games', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    // First insert = season_roster, then select = games, then insert = game_players
    mockDb.all.mockReturnValue([{ id: 'g1' }, { id: 'g2' }])
    await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    // insert called once for roster + once per game (2)
    expect(mockDb.insert).toHaveBeenCalledTimes(3)
  })

  it('does not insert game_players when no games exist', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })
})
