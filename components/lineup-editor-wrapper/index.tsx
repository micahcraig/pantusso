'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { EbbetsLineup, EbbetsState } from '@micahcraig/ebbets'
import { toEbbetsPlayers, fromEbbetsState, initEntries, detectNewlyBenched } from './logic'
export type { Position, LineupStatus, LineupEntry, PlayerSummary } from './logic'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

export type LineupEditorProps = {
  gameId:                string
  players:               import('./logic').PlayerSummary[]
  lineup:                import('./logic').LineupEntry[]
  onPlayerBenched?:      (playerIds: string[]) => void
  onSaveStatusChange?:   (status: SaveStatus) => void
}

const LineupManager = dynamic(
  () => import('@micahcraig/ebbets').then(m => ({ default: m.LineupManager })),
  { ssr: false },
)

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
]

import type { LineupEntry, PlayerSummary } from './logic'

export default function LineupEditorWrapper({ gameId, players, lineup, onPlayerBenched, onSaveStatusChange }: LineupEditorProps) {
  const colorMap = new Map(players.map((p, i) => [p.id, COLORS[i % COLORS.length]]))
  const knownIds = new Set(players.map(p => p.id))

  const [entries,      setEntries]      = useState<LineupEntry[]>(() => initEntries(lineup, players))
  const [ebbetsLineup, setEbbetsLineup] = useState<EbbetsLineup>({ outfield: '4', manualEH: false })
  const [saveStatus,   setSaveStatus]   = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entriesRef  = useRef(entries)
  const mountedRef  = useRef(false)
  entriesRef.current = entries

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function setStatus(s: SaveStatus) {
    setSaveStatus(s)
    onSaveStatusChange?.(s)
  }

  function scheduleSave(updated: LineupEntry[]) {
    setStatus('unsaved')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setStatus('saving')
      await fetch(`/api/games/${gameId}/lineup`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ entries: updated }),
      })
      setStatus('saved')
    }, 500)
  }

  function handleChange(state: EbbetsState) {
    const updated = fromEbbetsState(state, players, knownIds)
    const benched = detectNewlyBenched(entriesRef.current, updated)
    if (benched.length > 0) onPlayerBenched?.(benched)
    setEntries(updated)
    setEbbetsLineup(state.lineup)
    scheduleSave(updated)
  }

  // Sync entries when the confirmed player set changes
  const playerKey = players.map(p => p.id).sort().join(',')
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }

    const prev         = entriesRef.current
    const confirmedIds = new Set(players.map(p => p.id))
    const kept         = prev.filter(e => confirmedIds.has(e.playerId))
    const keptIds      = new Set(kept.map(e => e.playerId))
    const lastOrder    = kept
      .filter(e => e.lineupStatus === 'active' && e.battingOrder != null)
      .reduce((max, e) => Math.max(max, e.battingOrder!), 0)
    const added: LineupEntry[] = players
      .filter(p => !keptIds.has(p.id))
      .map((p, i) => ({
        playerId:     p.id,
        battingOrder: lastOrder + i + 1,
        position:     null,
        lineupStatus: 'active',
      }))
    const updated = [...kept, ...added]
    setEntries(updated)
    scheduleSave(updated)
  }, [playerKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (players.length === 0) {
    return (
      <p style={{ color: '#9ca3af', fontSize: 14 }}>
        No confirmed players yet. Mark players as confirmed in Attendance to build the lineup.
      </p>
    )
  }

  return (
    <div>
      <LineupManager
        players={toEbbetsPlayers(entries, players, colorMap)}
        lineup={ebbetsLineup}
        onLineupChange={handleChange}
        showTitle={false}
      />
    </div>
  )
}
