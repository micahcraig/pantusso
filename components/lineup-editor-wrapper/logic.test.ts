import { describe, it, expect } from 'vitest'
import { toEbbetsPlayers, fromEbbetsState, initEntries, detectNewlyBenched } from './logic'
import type { LineupEntry, PlayerSummary } from './logic'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function player(id: string, name = `Player ${id}`): PlayerSummary {
  return { id, name, jerseyNumber: id, preferredPositions: [] }
}

function active(playerId: string, battingOrder: number, position = ''): LineupEntry {
  return {
    playerId,
    battingOrder,
    position:     (position || null) as LineupEntry['position'],
    lineupStatus: 'active',
  }
}

function bench(playerId: string): LineupEntry {
  return { playerId, battingOrder: null, position: null, lineupStatus: 'bench' }
}

function colorMap(...ids: string[]): Map<string, string> {
  return new Map(ids.map((id, i) => [id, `#color${i}`]))
}

// ── toEbbetsPlayers ───────────────────────────────────────────────────────────

describe('toEbbetsPlayers', () => {
  it('returns empty array when entries is empty', () => {
    expect(toEbbetsPlayers([], [player('a')], colorMap('a'))).toEqual([])
  })

  it('maps active entries to ebbets format', () => {
    const players = [player('a', 'Alice')]
    const entries = [active('a', 1)]
    const result  = toEbbetsPlayers(entries, players, colorMap('a'))

    expect(result).toEqual([{ id: 'a', name: 'Alice', position: '', color: '#color0' }])
  })

  it('sorts by battingOrder regardless of input order', () => {
    const players = [player('a'), player('b'), player('c')]
    const entries = [active('c', 3), active('a', 1), active('b', 2)]
    const result  = toEbbetsPlayers(entries, players, colorMap('a', 'b', 'c'))

    expect(result.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('excludes bench entries', () => {
    const players = [player('a'), player('b')]
    const entries = [active('a', 1), bench('b')]
    const result  = toEbbetsPlayers(entries, players, colorMap('a', 'b'))

    expect(result.map(p => p.id)).toEqual(['a'])
  })

  it('excludes did_not_bat entries', () => {
    const players = [player('a')]
    const entries: LineupEntry[] = [{ playerId: 'a', battingOrder: 1, position: null, lineupStatus: 'did_not_bat' }]
    const result  = toEbbetsPlayers(entries, players, colorMap('a'))

    expect(result).toEqual([])
  })

  it('excludes active entries with null battingOrder', () => {
    const players = [player('a')]
    const entries: LineupEntry[] = [{ playerId: 'a', battingOrder: null, position: null, lineupStatus: 'active' }]
    const result  = toEbbetsPlayers(entries, players, colorMap('a'))

    expect(result).toEqual([])
  })

  it('excludes entries whose player is not in the players array (stale entry guard)', () => {
    const players = [player('b')]
    const entries = [active('a', 1), active('b', 2)]
    const result  = toEbbetsPlayers(entries, players, colorMap('b'))

    expect(result.map(p => p.id)).toEqual(['b'])
  })

  it('maps non-empty position through to ebbets', () => {
    const players = [player('a')]
    const entries = [active('a', 1, 'SS')]
    const result  = toEbbetsPlayers(entries, players, colorMap('a'))

    expect(result[0].position).toBe('SS')
  })

  it('maps null position to empty string for ebbets', () => {
    const players = [player('a')]
    const entries = [active('a', 1)]
    const result  = toEbbetsPlayers(entries, players, colorMap('a'))

    expect(result[0].position).toBe('')
  })

  it('assigns color from colorMap', () => {
    const players = [player('a')]
    const entries = [active('a', 1)]
    const cm      = new Map([['a', '#ff0000']])
    const result  = toEbbetsPlayers(entries, players, cm)

    expect(result[0].color).toBe('#ff0000')
  })

  it('falls back to gray when player has no color in map', () => {
    const players = [player('a')]
    const entries = [active('a', 1)]
    const result  = toEbbetsPlayers(entries, players, new Map())

    expect(result[0].color).toBe('#9ca3af')
  })
})

// ── fromEbbetsState ───────────────────────────────────────────────────────────

describe('fromEbbetsState', () => {
  function ebbetsState(playerIds: string[], positions: string[] = []) {
    return {
      players: playerIds.map((id, i) => ({ id, name: `Player ${id}`, position: positions[i] ?? '', color: '#000' })),
      lineup:  { outfield: '4' as const, manualEH: false },
    }
  }

  it('maps ebbets players to active entries with 1-based battingOrder', () => {
    const players  = [player('a'), player('b')]
    const knownIds = new Set(['a', 'b'])
    const result   = fromEbbetsState(ebbetsState(['a', 'b']), players, knownIds)

    expect(result).toEqual([
      { playerId: 'a', battingOrder: 1, position: null, lineupStatus: 'active' },
      { playerId: 'b', battingOrder: 2, position: null, lineupStatus: 'active' },
    ])
  })

  it('players not in ebbets state become bench entries', () => {
    const players  = [player('a'), player('b')]
    const knownIds = new Set(['a', 'b'])
    const result   = fromEbbetsState(ebbetsState(['a']), players, knownIds)

    expect(result).toContainEqual({ playerId: 'b', battingOrder: null, position: null, lineupStatus: 'bench' })
  })

  it('filters out phantom integer-ID players added by ebbets internally', () => {
    const players  = [player('uuid-a')]
    const knownIds = new Set(['uuid-a'])
    const state    = {
      players: [
        { id: 'uuid-a', name: 'Alice', position: '', color: '#000' },
        { id: 42,       name: 'Ghost', position: '', color: '#000' },  // phantom
      ],
      lineup: { outfield: '4' as const, manualEH: false },
    }
    const result = fromEbbetsState(state, players, knownIds)

    expect(result.map(e => e.playerId)).toEqual(['uuid-a'])
  })

  it('maps empty string position to null', () => {
    const players  = [player('a')]
    const knownIds = new Set(['a'])
    const result   = fromEbbetsState(ebbetsState(['a'], ['']), players, knownIds)

    expect(result[0].position).toBeNull()
  })

  it('maps non-empty position through', () => {
    const players  = [player('a')]
    const knownIds = new Set(['a'])
    const result   = fromEbbetsState(ebbetsState(['a'], ['3B']), players, knownIds)

    expect(result[0].position).toBe('3B')
  })

  it('returns all confirmed players as bench when ebbets players array is empty', () => {
    const players  = [player('a'), player('b')]
    const knownIds = new Set(['a', 'b'])
    const result   = fromEbbetsState(ebbetsState([]), players, knownIds)

    expect(result.every(e => e.lineupStatus === 'bench')).toBe(true)
    expect(result.map(e => e.playerId).sort()).toEqual(['a', 'b'])
  })

  it('preserves batting order based on position in ebbets array', () => {
    const players  = [player('a'), player('b'), player('c')]
    const knownIds = new Set(['a', 'b', 'c'])
    const result   = fromEbbetsState(ebbetsState(['c', 'a', 'b']), players, knownIds)

    const active = result.filter(e => e.lineupStatus === 'active')
    expect(active.map(e => e.playerId)).toEqual(['c', 'a', 'b'])
    expect(active.map(e => e.battingOrder)).toEqual([1, 2, 3])
  })
})

// ── detectNewlyBenched ────────────────────────────────────────────────────────

describe('detectNewlyBenched', () => {
  it('returns empty when nothing changed', () => {
    const entries = [active('a', 1), active('b', 2)]
    expect(detectNewlyBenched(entries, entries)).toEqual([])
  })

  it('detects a player who moved from active to bench', () => {
    const prev = [active('a', 1), active('b', 2)]
    const next = [active('a', 1), bench('b')]
    expect(detectNewlyBenched(prev, next)).toEqual(['b'])
  })

  it('detects multiple players newly benched at once', () => {
    const prev = [active('a', 1), active('b', 2), active('c', 3)]
    const next = [active('a', 1), bench('b'), bench('c')]
    expect(detectNewlyBenched(prev, next).sort()).toEqual(['b', 'c'])
  })

  it('does not flag players who were already on bench', () => {
    const prev = [active('a', 1), bench('b')]
    const next = [active('a', 1), bench('b')]
    expect(detectNewlyBenched(prev, next)).toEqual([])
  })

  it('does not flag players who were removed entirely (not in next)', () => {
    const prev = [active('a', 1), active('b', 2)]
    const next = [active('a', 1)]
    expect(detectNewlyBenched(prev, next)).toEqual([])
  })

  it('does not flag players newly added as active', () => {
    const prev = [active('a', 1)]
    const next = [active('a', 1), active('b', 2)]
    expect(detectNewlyBenched(prev, next)).toEqual([])
  })

  it('returns empty when both entry lists are empty', () => {
    expect(detectNewlyBenched([], [])).toEqual([])
  })
})

// ── initEntries ───────────────────────────────────────────────────────────────

describe('initEntries', () => {
  it('returns empty when both inputs are empty', () => {
    expect(initEntries([], [])).toEqual([])
  })

  it('initialises all confirmed players as active when no saved lineup', () => {
    const players = [player('a'), player('b')]
    const result  = initEntries([], players)

    expect(result).toEqual([
      { playerId: 'a', battingOrder: 1, position: null, lineupStatus: 'active' },
      { playerId: 'b', battingOrder: 2, position: null, lineupStatus: 'active' },
    ])
  })

  it('returns saved lineup unchanged when players match exactly', () => {
    const players = [player('a'), player('b')]
    const saved   = [active('a', 1, 'P'), active('b', 2)]
    const result  = initEntries(saved, players)

    expect(result).toEqual(saved)
  })

  it('filters out saved entries for players who are no longer confirmed', () => {
    const players = [player('b')]
    const saved   = [active('a', 1), active('b', 2)]
    const result  = initEntries(saved, players)

    expect(result.map(e => e.playerId)).toEqual(['b'])
  })

  it('appends newly confirmed players after the last active batting order', () => {
    const players = [player('a'), player('b'), player('c')]
    const saved   = [active('a', 1), active('b', 2)]
    const result  = initEntries(saved, players)

    const newEntry = result.find(e => e.playerId === 'c')
    expect(newEntry).toMatchObject({ battingOrder: 3, lineupStatus: 'active' })
  })

  it('lastOrder ignores bench entries — new players slot after active entries only', () => {
    const players = [player('a'), player('b'), player('c')]
    const saved   = [active('a', 1), bench('b')]
    const result  = initEntries(saved, players)

    const newEntry = result.find(e => e.playerId === 'c')
    expect(newEntry?.battingOrder).toBe(2)  // after order=1, not after bench
  })

  it('handles multiple newly confirmed players with sequential batting orders', () => {
    const players = [player('a'), player('b'), player('c')]
    const saved   = [active('a', 3)]
    const result  = initEntries(saved, players)

    const orders = result
      .filter(e => e.playerId !== 'a')
      .map(e => e.battingOrder)
      .sort()
    expect(orders).toEqual([4, 5])
  })

  it('preserves position and status from saved entries', () => {
    const players = [player('a')]
    const saved: LineupEntry[] = [{ playerId: 'a', battingOrder: 1, position: 'SS', lineupStatus: 'active' }]
    const result  = initEntries(saved, players)

    expect(result[0].position).toBe('SS')
    expect(result[0].lineupStatus).toBe('active')
  })

  it('handles confirmed players who have a bench entry in saved lineup', () => {
    const players = [player('a'), player('b')]
    const saved   = [bench('a')]
    const result  = initEntries(saved, players)

    // 'a' comes from saved as bench; 'b' is new → active at order 1
    expect(result.find(e => e.playerId === 'a')?.lineupStatus).toBe('bench')
    expect(result.find(e => e.playerId === 'b')?.lineupStatus).toBe('active')
    expect(result.find(e => e.playerId === 'b')?.battingOrder).toBe(1)
  })
})
