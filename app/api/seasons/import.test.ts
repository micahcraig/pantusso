import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

let uuidCounter = 0
const mockRandomUUID = vi.hoisted(() => vi.fn(() => `uuid-${++uuidCounter}`))
vi.mock('crypto', () => ({ randomUUID: mockRandomUUID }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','insert','values','get','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','insert','values']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))

vi.mock('drizzle-orm', () => ({ eq: vi.fn() }))
vi.mock('@/db/schema', () => ({
  seasons:      {},
  seasonRoster: {},
  players:      {},
  games:        {},
  opponents:    {},
  gamePlayers:  {},
  lineupEntries:{},
  activityLog:  {},
}))

import { POST } from '@/app/api/seasons/import/route'

const adminSession = { user: { id: 'u1', role: 'admin' } }
const managerSession = { user: { id: 'u2', role: 'manager' } }

const validBody = {
  version: 1,
  season: { name: 'Spring 2026', startDate: '2026-03-01', endDate: '2026-05-31' },
  players: [
    { name: 'Alice', jerseyNumber: '7', preferredPositions: ['SS'], phone: null, email: null, notes: null },
  ],
  games: [
    {
      opponentName:  'Diamond Devils',
      date:          '2026-04-01',
      time:          '18:00',
      location:      'Field 1',
      homeOrAway:    'home',
      ourScore:      5,
      opponentScore: 3,
      status:        'completed',
      attendance:    [{ playerName: 'Alice', attendance: 'confirmed', note: null }],
      lineup:        [{ playerName: 'Alice', battingOrder: 1, position: 'SS', lineupStatus: 'active' }],
    },
  ],
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/seasons/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/seasons/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    mockDb.select.mockReturnValue(mockDb)
    mockDb.from.mockReturnValue(mockDb)
    mockDb.where.mockReturnValue(mockDb)
    mockDb.insert.mockReturnValue(mockDb)
    mockDb.values.mockReturnValue(mockDb)
  })

  it('returns 403 for non-admin session', async () => {
    mockGetServerSession.mockResolvedValue(managerSession)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 403 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid JSON', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const req = new Request('http://localhost/api/seasons/import', {
      method: 'POST',
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when version is unsupported', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const res = await POST(makeRequest({ ...validBody, version: 3 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when season is missing', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    const { season: _season, ...noSeason } = validBody
    const res = await POST(makeRequest(noSeason))
    expect(res.status).toBe(400)
  })

  it('creates a new player when one does not exist', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.get.mockReturnValue(undefined) // no existing player, no existing opponent

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    // insert called for: new player, new opponent, season, season_roster, game, game_player, lineup_entry
    expect(mockDb.insert).toHaveBeenCalledTimes(7)
  })

  it('reuses an existing player by name', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    // First .get() = existing player, second .get() = no existing opponent
    mockDb.get
      .mockReturnValueOnce({ id: 'existing-player-id' })
      .mockReturnValue(undefined)

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    // should NOT insert a new player — only opponent, season, roster, game, game_player, lineup
    expect(mockDb.insert).toHaveBeenCalledTimes(6)
  })

  it('reuses an existing opponent by name', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    // First .get() = no existing player, second .get() = existing opponent
    mockDb.get
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'existing-opponent-id' })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    // should NOT insert a new opponent — player, season, roster, game, game_player, lineup
    expect(mockDb.insert).toHaveBeenCalledTimes(6)
  })

  it('returns the new season id', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.get.mockReturnValue(undefined)

    const res = await POST(makeRequest(validBody))
    const body = await res.json()
    expect(body.seasonId).toBeDefined()
    expect(typeof body.seasonId).toBe('string')
  })

  it('skips attendance/lineup rows for unknown player names', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.get.mockReturnValue(undefined)

    const bodyWithUnknown = {
      ...validBody,
      games: [{
        ...validBody.games[0],
        attendance: [{ playerName: 'Unknown Player', attendance: 'confirmed', note: null }],
        lineup:     [{ playerName: 'Unknown Player', battingOrder: 1, position: 'SS', lineupStatus: 'active' }],
      }],
    }

    const res = await POST(makeRequest(bodyWithUnknown))
    expect(res.status).toBe(201)
    // player, opponent, season, roster, game — no game_player or lineup_entry for unknown
    expect(mockDb.insert).toHaveBeenCalledTimes(5)
  })

  it('always creates a new season (does not deduplicate by name)', async () => {
    mockGetServerSession.mockResolvedValue(adminSession)
    mockDb.get.mockReturnValue(undefined)

    await POST(makeRequest(validBody))
    await POST(makeRequest(validBody))

    // seasons table should be inserted twice
    const seasonInsertCalls = mockDb.values.mock.calls.filter(
      ([arg]) => arg && 'startDate' in arg && 'endDate' in arg && 'name' in arg
    )
    expect(seasonInsertCalls.length).toBeGreaterThanOrEqual(2)
  })
})
