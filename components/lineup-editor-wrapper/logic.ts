import type { EbbetsPlayer, EbbetsState } from '@micahcraig/ebbets'

export type Position     = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DP' | 'FLEX' | 'BN'
export type LineupStatus = 'active' | 'bench' | 'did_not_bat'

export type LineupEntry = {
  playerId:     string
  battingOrder: number | null
  position:     Position | null
  lineupStatus: LineupStatus
}

export type PlayerSummary = {
  id:                 string
  name:               string
  jerseyNumber:       string
  preferredPositions: Position[]
}

export function toEbbetsPlayers(
  entries:  LineupEntry[],
  players:  PlayerSummary[],
  colorMap: Map<string, string>,
): EbbetsPlayer[] {
  return entries
    .filter(e =>
      e.lineupStatus === 'active' &&
      e.battingOrder != null &&
      players.some(p => p.id === e.playerId)
    )
    .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0))
    .map(e => {
      const p = players.find(p => p.id === e.playerId)!
      return {
        id:       e.playerId,
        name:     p.name,
        position: e.position ?? '',
        color:    colorMap.get(e.playerId) ?? '#9ca3af',
      }
    })
}

export function fromEbbetsState(
  state:      EbbetsState,
  allPlayers: PlayerSummary[],
  knownIds:   Set<string>,
): LineupEntry[] {
  const active    = state.players.filter(p => knownIds.has(String(p.id)))
  const activeIds = new Set(active.map(p => String(p.id)))

  const activeEntries: LineupEntry[] = active.map((p, i) => ({
    playerId:     String(p.id),
    battingOrder: i + 1,
    position:     (p.position as Position) || null,
    lineupStatus: 'active',
  }))

  const benchEntries: LineupEntry[] = allPlayers
    .filter(p => !activeIds.has(p.id))
    .map(p => ({
      playerId:     p.id,
      battingOrder: null,
      position:     null,
      lineupStatus: 'bench',
    }))

  return [...activeEntries, ...benchEntries]
}

export function detectNewlyBenched(
  prevEntries: LineupEntry[],
  nextEntries: LineupEntry[],
): string[] {
  const prevActiveIds = new Set(
    prevEntries.filter(e => e.lineupStatus === 'active').map(e => e.playerId)
  )
  return nextEntries
    .filter(e => e.lineupStatus === 'bench' && prevActiveIds.has(e.playerId))
    .map(e => e.playerId)
}

export function initEntries(
  savedLineup:       LineupEntry[],
  confirmedPlayers:  PlayerSummary[],
): LineupEntry[] {
  const confirmedIds = new Set(confirmedPlayers.map(p => p.id))
  const filtered     = savedLineup.filter(e => confirmedIds.has(e.playerId))
  const savedIds     = new Set(filtered.map(e => e.playerId))
  const lastOrder    = filtered
    .filter(e => e.lineupStatus === 'active' && e.battingOrder != null)
    .reduce((max, e) => Math.max(max, e.battingOrder!), 0)

  const newActive: LineupEntry[] = confirmedPlayers
    .filter(p => !savedIds.has(p.id))
    .map((p, i) => ({
      playerId:     p.id,
      battingOrder: lastOrder + i + 1,
      position:     null,
      lineupStatus: 'active',
    }))

  return [...filtered, ...newActive]
}
