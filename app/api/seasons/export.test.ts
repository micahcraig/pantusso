import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetServerSession = vi.hoisted(() => vi.fn())
vi.mock('next-auth', () => ({ getServerSession: mockGetServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','orderBy','insert','values','get','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','orderBy']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})
vi.mock('@/db', () => ({ db: mockDb }))

vi.mock('drizzle-orm', () => ({
  eq:      vi.fn(),
  asc:     vi.fn(),
  inArray: vi.fn(),
}))
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

import { GET } from '@/app/api/seasons/[id]/export/route'

const seasonRow = { id: 's1', name: 'Spring 2026', startDate: '2026-03-01', endDate: '2026-05-31' }
const rosterRows = [
  { id: 'p1', name: 'Alice', jerseyNumber: '7', preferredPositions: ['SS'], phone: null, email: null, notes: null },
]
const gameRows = [
  { id: 'g1', date: '2026-04-01', time: '18:00', location: 'Field 1', homeOrAway: 'home', ourScore: 5, opponentScore: 3, status: 'completed', opponentName: 'Diamond Devils' },
]
const attendanceRows = [
  { gameId: 'g1', playerName: 'Alice', attendance: 'confirmed', note: null },
]
const lineupRows = [
  { gameId: 'g1', playerName: 'Alice', battingOrder: 1, position: 'SS', lineupStatus: 'active' },
]

function makeRequest(id: string) {
  return new Request(`http://localhost/api/seasons/${id}/export`)
}

describe('GET /api/seasons/[id]/export', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 when season not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockDb.get.mockReturnValue(undefined)
    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    expect(res.status).toBe(404)
  })

  it('returns export data with version 2', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockDb.get.mockReturnValue(seasonRow)
    mockDb.all
      .mockReturnValueOnce(rosterRows)    // roster
      .mockReturnValueOnce(gameRows)      // games
      .mockReturnValueOnce(attendanceRows) // attendance
      .mockReturnValueOnce(lineupRows)    // lineup
      .mockReturnValueOnce([])            // activityLog

    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.version).toBe(2)
    expect(body.season.name).toBe('Spring 2026')
  })

  it('exports players without internal ids', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockDb.get.mockReturnValue(seasonRow)
    mockDb.all
      .mockReturnValueOnce(rosterRows)
      .mockReturnValueOnce(gameRows)
      .mockReturnValueOnce(attendanceRows)
      .mockReturnValueOnce(lineupRows)
      .mockReturnValueOnce([])            // activityLog

    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    const body = await res.json()
    expect(body.players).toHaveLength(1)
    expect(body.players[0].name).toBe('Alice')
    expect(body.players[0].id).toBeUndefined()
  })

  it('embeds attendance and lineup in each game', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockDb.get.mockReturnValue(seasonRow)
    mockDb.all
      .mockReturnValueOnce(rosterRows)
      .mockReturnValueOnce(gameRows)
      .mockReturnValueOnce(attendanceRows)
      .mockReturnValueOnce(lineupRows)
      .mockReturnValueOnce([])            // activityLog

    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    const body = await res.json()
    expect(body.games).toHaveLength(1)
    expect(body.games[0].opponentName).toBe('Diamond Devils')
    expect(body.games[0].attendance).toHaveLength(1)
    expect(body.games[0].attendance[0].playerName).toBe('Alice')
    expect(body.games[0].lineup).toHaveLength(1)
    expect(body.games[0].lineup[0].battingOrder).toBe(1)
  })

  it('handles seasons with no games', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })
    mockDb.get.mockReturnValue(seasonRow)
    mockDb.all
      .mockReturnValueOnce(rosterRows) // roster
      .mockReturnValueOnce([])         // no games
      .mockReturnValueOnce([])         // activityLog (always queried)

    const res = await GET(makeRequest('s1'), { params: { id: 's1' } })
    const body = await res.json()
    expect(body.games).toEqual([])
    // attendance/lineup .all() should NOT be called when there are no games
    expect(mockDb.all).toHaveBeenCalledTimes(3)
  })
})
