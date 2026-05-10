import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLookupPlayerByToken = vi.hoisted(() => vi.fn())
const mockGetUpcomingGames    = vi.hoisted(() => vi.fn())
const mockSetAttendance       = vi.hoisted(() => vi.fn())
vi.mock('@/lib/availability', () => ({
  lookupPlayerByToken: mockLookupPlayerByToken,
  getUpcomingGames:    mockGetUpcomingGames,
  setAttendance:       mockSetAttendance,
}))

import { GET, PATCH } from '@/app/api/availability/[token]/route'

const player = { id: 'p1', name: 'Alice', availabilityToken: 'tok-abc' }

function makeGet(token: string) {
  return new Request(`http://localhost/api/availability/${token}`)
}
function makePatch(token: string, body: unknown) {
  return new Request(`http://localhost/api/availability/${token}`, {
    method: 'PATCH',
    body:   JSON.stringify(body),
  })
}

describe('GET /api/availability/[token]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when token is not found', async () => {
    mockLookupPlayerByToken.mockResolvedValue(null)
    const res = await GET(makeGet('bad-token'), { params: { token: 'bad-token' } })
    expect(res.status).toBe(404)
  })

  it('returns player and seasons when token is valid', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    mockGetUpcomingGames.mockResolvedValue({ seasons: [{ seasonName: 'Spring 2026', games: [{ id: 'g1' }] }] })

    const res = await GET(makeGet('tok-abc'), { params: { token: 'tok-abc' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.player).toEqual({ id: 'p1', name: 'Alice' })
    expect(body.seasons).toHaveLength(1)
    expect(body.seasons[0].seasonName).toBe('Spring 2026')
    expect(body.seasons[0].games).toHaveLength(1)
  })

  it('calls getUpcomingGames with the player id', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    mockGetUpcomingGames.mockResolvedValue({ seasons: [] })
    await GET(makeGet('tok-abc'), { params: { token: 'tok-abc' } })
    expect(mockGetUpcomingGames).toHaveBeenCalledWith('p1')
  })
})

describe('PATCH /api/availability/[token]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 404 when token is not found', async () => {
    mockLookupPlayerByToken.mockResolvedValue(null)
    const res = await PATCH(makePatch('bad-token', { updates: [] }), { params: { token: 'bad-token' } })
    expect(res.status).toBe(404)
  })

  it('returns 400 when updates is empty', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    const res = await PATCH(makePatch('tok-abc', { updates: [] }), { params: { token: 'tok-abc' } })
    expect(res.status).toBe(400)
  })

  it('returns 400 when updates is missing', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    const res = await PATCH(makePatch('tok-abc', {}), { params: { token: 'tok-abc' } })
    expect(res.status).toBe(400)
  })

  it('calls setAttendance for each update', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    mockSetAttendance.mockResolvedValue(undefined)
    const updates = [
      { gameId: 'g1', attendance: 'confirmed', note: null },
      { gameId: 'g2', attendance: 'out',       note: 'Vacation' },
    ]
    const res = await PATCH(makePatch('tok-abc', { updates }), { params: { token: 'tok-abc' } })
    expect(res.status).toBe(200)
    expect(mockSetAttendance).toHaveBeenCalledTimes(2)
    expect(mockSetAttendance).toHaveBeenCalledWith('g1', 'p1', 'confirmed', null)
    expect(mockSetAttendance).toHaveBeenCalledWith('g2', 'p1', 'out', 'Vacation')
  })

  it('returns ok: true on success', async () => {
    mockLookupPlayerByToken.mockResolvedValue(player)
    mockSetAttendance.mockResolvedValue(undefined)
    const res = await PATCH(
      makePatch('tok-abc', { updates: [{ gameId: 'g1', attendance: 'maybe' }] }),
      { params: { token: 'tok-abc' } },
    )
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
