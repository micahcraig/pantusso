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

  it('returns the player when the token matches', async () => {
    const player = { id: 'p1', name: 'Alice', availabilityToken: 'tok-123' }
    mockDb.get.mockReturnValue(player)
    expect(await lookupPlayerByToken('tok-123')).toEqual(player)
  })

  it('returns null when no player matches the token', async () => {
    mockDb.get.mockReturnValue(undefined)
    expect(await lookupPlayerByToken('bad-token')).toBeNull()
  })
})

// ── getUpcomingGames ───────────────────────────────────────────────────────────

describe('getUpcomingGames', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty seasons when the player has no roster entries', async () => {
    mockDb.all.mockReturnValueOnce([]) // no rostered seasons
    const result = await getUpcomingGames('p1')
    expect(result).toEqual({ seasons: [] })
  })

  it('returns seasons with upcoming games when rostered', async () => {
    const gameRows = [
      { seasonId: 's1', seasonName: 'Spring 2026', seasonStart: '2026-04-01',
        gameId: 'g1', date: '2026-06-01', time: '18:30', location: 'Field 1',
        homeOrAway: 'home', opponentName: 'Rivals', attendance: 'unknown', note: null },
    ]
    mockDb.all.mockReturnValueOnce([{ seasonId: 's1' }]) // rostered seasons
    mockDb.all.mockReturnValueOnce(gameRows)              // game rows

    const result = await getUpcomingGames('p1')

    expect(result.seasons).toHaveLength(1)
    expect(result.seasons[0].seasonName).toBe('Spring 2026')
    expect(result.seasons[0].games).toHaveLength(1)
    expect(result.seasons[0].games[0].gameId).toBe('g1')
  })

  it('returns empty seasons array when no upcoming scheduled games', async () => {
    mockDb.all.mockReturnValueOnce([{ seasonId: 's1' }]) // rostered seasons
    mockDb.all.mockReturnValueOnce([])                   // no upcoming games

    const result = await getUpcomingGames('p1')

    expect(result.seasons).toHaveLength(0)
  })
})

// ── setAttendance ──────────────────────────────────────────────────────────────

describe('setAttendance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates an existing game_player record', async () => {
    // Use mockReturnValueOnce so subsequent get() calls (gameInfo, playerInfo) return
    // undefined, preventing logActivity from firing and keeping insert call count at 0.
    mockDb.get.mockReturnValueOnce({ id: 'gp1', availabilitySetAt: new Date('2026-05-01') })
    await setAttendance('g1', 'p1', 'confirmed')
    expect(mockDb.update).toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
  })

  it('preserves the original availabilitySetAt when updating', async () => {
    const originalSetAt = new Date('2026-05-01')
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: originalSetAt })
    await setAttendance('g1', 'p1', 'confirmed')
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.availabilitySetAt).toBe(originalSetAt)
  })

  it('includes the note when provided on update', async () => {
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: null })
    await setAttendance('g1', 'p1', 'maybe', 'might be late')
    const setCall = mockDb.set.mock.calls[0][0]
    expect(setCall.note).toBe('might be late')
  })

  it('omits the note field when not provided on update', async () => {
    mockDb.get.mockReturnValue({ id: 'gp1', availabilitySetAt: null })
    await setAttendance('g1', 'p1', 'confirmed')
    const setCall = mockDb.set.mock.calls[0][0]
    expect('note' in setCall).toBe(false)
  })

  it('inserts a new record when no game_player row exists', async () => {
    mockDb.get.mockReturnValue(undefined)
    await setAttendance('g1', 'p1', 'out')
    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('inserts with the correct gameId, playerId, and attendance', async () => {
    mockDb.get.mockReturnValue(undefined)
    await setAttendance('g1', 'p1', 'out')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall).toMatchObject({ gameId: 'g1', playerId: 'p1', attendance: 'out' })
  })

  it('inserts with the note when provided', async () => {
    mockDb.get.mockReturnValue(undefined)
    await setAttendance('g1', 'p1', 'maybe', 'travelling')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.note).toBe('travelling')
  })

  it('inserts with null note when none provided', async () => {
    mockDb.get.mockReturnValue(undefined)
    await setAttendance('g1', 'p1', 'confirmed')
    const valuesCall = mockDb.values.mock.calls[0][0]
    expect(valuesCall.note).toBeNull()
  })
})
