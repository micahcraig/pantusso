import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockLogActivity = vi.hoisted(() => vi.fn())
vi.mock('@/lib/activity', () => ({ logActivity: mockLogActivity }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','insert','values','delete','all','get','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','insert','values','delete']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), ne: vi.fn(), inArray: vi.fn() }))
vi.mock('@/db/schema', () => ({ seasonRoster: {}, players: {}, seasons: {}, games: {}, gamePlayers: {} }))

import { GET, POST, PATCH } from '@/app/api/seasons/[id]/roster/route'

const adminSession   = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

function makePost(id: string, body: unknown) {
  return new Request(`http://localhost/api/seasons/${id}/roster`, {
    method: 'POST',
    body:   JSON.stringify(body),
  })
}

function makePatch(id: string, body: unknown) {
  return new Request(`http://localhost/api/seasons/${id}/roster`, {
    method: 'PATCH',
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
    const rows = [{ playerId: 'p1', name: 'Alice', jerseyNumber: '7', preferredPositions: [], isActive: true }]
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

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(401)
  })

  it('allows manager to add to roster', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(201)
  })

  it('returns 400 when playerId is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makePost('s1', {}), { params: { id: 's1' } })
    expect(res.status).toBe(400)
  })

  it('inserts roster entry and returns 201', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    const res = await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('backfills game_players for existing non-cancelled games', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([{ id: 'g1' }, { id: 'g2' }])
    await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(mockDb.insert).toHaveBeenCalledTimes(3) // 1 roster + 2 game_players
  })

  it('does not insert game_players when no games exist', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.run.mockReturnValue(undefined)
    mockDb.all.mockReturnValue([])
    await POST(makePost('s1', { playerId: 'p1' }), { params: { id: 's1' } })
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
  })
})

describe('PATCH /api/seasons/[id]/roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnValue(mockDb)
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
    mockDb.delete.mockReturnValue(mockDb)
    mockDb.run.mockReturnValue(undefined)
    mockLogActivity.mockResolvedValue(undefined)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
    expect(res.status).toBe(401)
  })

  it('returns 400 when playerId is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await PATCH(makePatch('s1', { inRoster: true }), { params: { id: 's1' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when inRoster is not a boolean', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await PATCH(makePatch('s1', { playerId: 'p1', inRoster: 'yes' }), { params: { id: 's1' } })
    expect(res.status).toBe(400)
  })

  it('allows manager to update roster', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    mockDb.all.mockReturnValueOnce([]) // no scheduled games
    mockDb.get.mockReturnValueOnce({ playerId: 'p1' }) // already in roster
    const res = await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
    expect(res.status).toBe(200)
  })

  describe('inRoster: true', () => {
    it('inserts into seasonRoster when player is not already rostered', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])        // no scheduled games
      mockDb.get.mockReturnValueOnce(undefined) // not in roster
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })  // player lookup
      mockDb.get.mockReturnValueOnce({ name: 'Spring' }) // season lookup
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
    })

    it('does not insert when player is already rostered', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])                 // no scheduled games
      mockDb.get.mockReturnValueOnce({ playerId: 'p1' }) // already in roster
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).not.toHaveBeenCalled()
    })

    it('logs ringer_added activity when adding a new player', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      mockDb.get.mockReturnValueOnce(undefined)
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })
      mockDb.get.mockReturnValueOnce({ name: 'Spring' })
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockLogActivity).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ringer_added' }))
    })

    it('does not log activity when player is already rostered', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      mockDb.get.mockReturnValueOnce({ playerId: 'p1' })
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockLogActivity).not.toHaveBeenCalled()
    })

    it('backfills all scheduled games when none have the player yet', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([{ id: 'g1' }, { id: 'g2' }]) // scheduled games
      mockDb.get.mockReturnValueOnce(undefined)          // not in roster
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })
      mockDb.get.mockReturnValueOnce({ name: 'Spring' })
      mockDb.all.mockReturnValueOnce([])                 // no existing game_players
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).toHaveBeenCalledTimes(2) // roster insert + batch game_players insert
    })

    it('only backfills games where the player is not already present', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([{ id: 'g1' }, { id: 'g2' }])
      mockDb.get.mockReturnValueOnce(undefined)
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })
      mockDb.get.mockReturnValueOnce({ name: 'Spring' })
      mockDb.all.mockReturnValueOnce([{ gameId: 'g1' }]) // g1 already has the player
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).toHaveBeenCalledTimes(2) // roster + only g2
    })

    it('skips game_players insert when player is already in all scheduled games', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([{ id: 'g1' }])
      mockDb.get.mockReturnValueOnce(undefined)
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })
      mockDb.get.mockReturnValueOnce({ name: 'Spring' })
      mockDb.all.mockReturnValueOnce([{ gameId: 'g1' }]) // already covered
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).toHaveBeenCalledTimes(1) // roster only
    })

    it('skips game_players check when there are no scheduled games', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      mockDb.get.mockReturnValueOnce(undefined)
      mockDb.get.mockReturnValueOnce({ name: 'Alice' })
      mockDb.get.mockReturnValueOnce({ name: 'Spring' })
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(mockDb.all).toHaveBeenCalledTimes(1) // only the scheduled-games query
    })

    it('returns 200 ok', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      mockDb.get.mockReturnValueOnce({ playerId: 'p1' })
      const res = await PATCH(makePatch('s1', { playerId: 'p1', inRoster: true }), { params: { id: 's1' } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })
  })

  describe('inRoster: false', () => {
    it('deletes the player from seasonRoster', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([]) // no scheduled games
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: false }), { params: { id: 's1' } })
      expect(mockDb.delete).toHaveBeenCalledTimes(1)
    })

    it('also removes game_players for scheduled games', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([{ id: 'g1' }, { id: 'g2' }])
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: false }), { params: { id: 's1' } })
      expect(mockDb.delete).toHaveBeenCalledTimes(2)
    })

    it('does not delete game_players when no scheduled games exist', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      await PATCH(makePatch('s1', { playerId: 'p1', inRoster: false }), { params: { id: 's1' } })
      expect(mockDb.delete).toHaveBeenCalledTimes(1)
    })

    it('returns 200 ok', async () => {
      mockGetServerSession.mockResolvedValue(adminSession)
      mockDb.all.mockReturnValueOnce([])
      const res = await PATCH(makePatch('s1', { playerId: 'p1', inRoster: false }), { params: { id: 's1' } })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })
  })
})
