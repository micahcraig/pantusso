import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','innerJoin','leftJoin','orderBy',
                   'insert','values','update','set','get','all','run']) {
    chain[m] = vi.fn()
  }
  for (const m of ['select','from','where','innerJoin','leftJoin','orderBy',
                   'insert','values','update','set']) {
    chain[m].mockReturnValue(chain)
  }
  return chain
})

vi.mock('@/db', () => ({ db: mockDb }))

import { lookupPlayerByToken, getUpcomingGames, setAttendance } from '@/lib/availability'

// ── lookupPlayerByToken ────────────────────────────────────────────────────────

describe('lookupPlayerByToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the player when the token matches', () => {
    const player = { id: 'p1', name: 'Alice', availabilityToken: 'tok-123' }
    mockDb.get.mockReturnValue(player)
    expect(lookupPlayerByToken('tok-123')).toEqual(player)
  })

  it('returns null when no player matches the token', () => {
    mockDb.get.mockReturnValue(undefined)
    expect(lookupPlayerByToken('bad-token')).toBeNull()
  })
})

// ── getUpcomingGames ───────────────────────────────────────────────────────────

describe('getUpcomingGames', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty when the player has no roster entry', () => {
    mockDb.get.mockReturnValue(undefined)
    const result = getUpcomingGames('p1')
    expect(result).toEqual({ seasonName: null, games: [] })
  })

  it('returns season name and upcoming games when rostered', () => {
    const rosterEntry = { seasonId: 's1', seasonName: 'Spring 2026' }
    const gameRows = [
      { gameId: 'g1', date: '2026-06-01', time: '18:30', location: 'Field 1',
        homeOrAway: 'home', opponentName: 'Rivals', attendance: 'unknown', note: null },
    ]
    mockDb.get.mockReturnValue(rosterEntry)
    mockDb.all.mockReturnValue(gameRows)

    const result = getUpcomingGames('p1')

    expect(result.seasonName).toBe('Spring 2026')
    expect(result.games).toEqual(gameRows)
  })

  it('returns an empty games array when there are no upcoming scheduled games', () => {
    mockDb.get.mockReturnValue({ seasonId: 's1', seasonName: 'Spring 2026' })
    mockDb.all.mockReturnValue([])

    const result = getUpcomingGames('p1')

    expect(result.seasonName).toBe('Spring 2026')
    expect(result.games).toHaveLength(0)
  })
})

// ── setAttendance ──────────────────────────────────────────────────────────────

describe('setAttendance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates an existing game_player record', () => {
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: new Date('2026-05-01') })
    setAttendance('g1', 'p1', 'confirmed')
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('preserves the original availabilitySetAt when updating', () => {
    const originalSetAt = new Date('2026-05-01')
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: originalSetAt })
    setAttendance('g1', 'p1', 'confirmed')
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.availabilitySetAt).toBe(originalSetAt)
  })

  it('includes the note when provided on update', () => {
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: null })
    setAttendance('g1', 'p1', 'maybe', 'might be late')
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.note).toBe('might be late')
  })

  it('omits the note field when not provided on update', () => {
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: null })
    setAttendance('g1', 'p1', 'confirmed')
    const setCall = mockDb.set.mock.calls[0][0]
    expect('note' in setCall).toBe(false)
  })

  it('inserts a new record when no game_player row exists', () => {
    mockDb.get.mockReturnValue(undefined)
    setAttendance('g1', 'p1', 'out')
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('inserts with the correct gameId, playerId, and attendance', () => {
    mockDb.get.mockReturnValue(undefined)
    setAttendance('g1', 'p1', 'out')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall).toMatchObject({ gameId: 'g1', playerId: 'p1', attendance: 'out' })
  })

  it('inserts with the note when provided', () => {
    mockDb.get.mockReturnValue(undefined)
    setAttendance('g1', 'p1', 'maybe', 'travelling')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.note).toBe('travelling')
  })

  it('inserts with null note when none provided', () => {
    mockDb.get.mockReturnValue(undefined)
    setAttendance('g1', 'p1', 'confirmed')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.note).toBeNull()
  })
})
