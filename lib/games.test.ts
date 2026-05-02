import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select','from','where','insert','values','returning','get','all','run']) {
    chain[m] = vi.fn()
  }
  chain.select.mockReturnValue(chain)
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.values.mockReturnValue(chain)
  chain.returning.mockReturnValue(chain)
  return chain
})

vi.mock('@/db', () => ({ db: mockDb }))

import { createGameWithRoster } from '@/lib/games'

const gameData = {
  seasonId:     's1',
  opponentId:   'o1',
  date:         '2026-06-01',
  time:         '18:30',
  location:     'Riverside Diamond',
  homeOrAway:   'home' as const,
  ourScore:     null,
  opponentScore: null,
  status:       'scheduled' as const,
}

describe('createGameWithRoster', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts the game and returns it', () => {
    const createdGame = { id: 'g1', ...gameData }
    mockDb.get.mockReturnValue(createdGame)
    mockDb.all.mockReturnValue([])

    const result = createGameWithRoster(gameData)

    expect(mockDb.insert).toHaveBeenCalled()
    expect(result).toEqual(createdGame)
  })

  it('seeds a game_player row for each rostered player', () => {
    const createdGame = { id: 'g1', ...gameData }
    mockDb.get.mockReturnValue(createdGame)
    mockDb.all.mockReturnValue([{ playerId: 'p1' }, { playerId: 'p2' }, { playerId: 'p3' }])

    createGameWithRoster(gameData)

    // insert called once for the game + once per player = 4
    expect(mockDb.insert).toHaveBeenCalledTimes(4)
    expect(mockDb.run).toHaveBeenCalledTimes(3)
  })

  it('seeds no game_player rows when roster is empty', () => {
    mockDb.get.mockReturnValue({ id: 'g1', ...gameData })
    mockDb.all.mockReturnValue([])

    createGameWithRoster(gameData)

    expect(mockDb.run).not.toHaveBeenCalled()
  })

  it('passes attendance as "unknown" for each seeded player', () => {
    mockDb.get.mockReturnValue({ id: 'g1', ...gameData })
    mockDb.all.mockReturnValue([{ playerId: 'p1' }])

    createGameWithRoster(gameData)

    const valuesCall = mockDb.values.mock.calls.find(
      ([arg]) => arg && 'attendance' in arg
    )
    expect(valuesCall?.[0]).toMatchObject({ attendance: 'unknown', gameId: 'g1', playerId: 'p1' })
  })
})
