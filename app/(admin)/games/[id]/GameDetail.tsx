'use client'

import { useState, useMemo } from 'react'
import AttendancePanel from './AttendancePanel'
import LineupEditorWrapper from '@/components/lineup-editor-wrapper'
import type { AttendanceRow } from './AttendancePanel'
import type { PlayerSummary, LineupEntry, SaveStatus } from '@/components/lineup-editor-wrapper'
import type { AttendanceStatus } from '@/db/schema'

type Tab = 'attendance' | 'lineup'

export default function GameDetail({
  gameId,
  gameStatus,
  allPlayers,
  savedLineup,
}: {
  gameId:      string
  gameStatus:  string
  allPlayers:  AttendanceRow[]
  savedLineup: LineupEntry[]
}) {
  const [tab,        setTab]        = useState<Tab>('attendance')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(allPlayers.map(p => [p.playerId, p.attendance]))
  )

  const confirmedPlayers = useMemo<PlayerSummary[]>(
    () => allPlayers
      .filter(p => attendance[p.playerId] === 'confirmed')
      .map(p => ({
        id:                 p.playerId,
        name:               p.name,
        jerseyNumber:       p.jerseyNumber,
        preferredPositions: p.preferredPositions,
      })),
    [allPlayers, attendance]
  )

  const confirmedCount = confirmedPlayers.length

  async function handleSet(playerId: string, status: AttendanceStatus) {
    setAttendance(prev => ({ ...prev, [playerId]: status }))
    await fetch(`/api/games/${gameId}/attendance`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ updates: [{ playerId, attendance: status }] }),
    })
  }

  const saveIcon = (
    <span style={{
      fontSize:     11,
      color:        saveStatus === 'saved'  ? '#16a34a' :
                    saveStatus === 'saving' ? '#6b7280' : '#d97706',
    }}>
      {saveStatus === 'saved' ? '✓' : saveStatus === 'saving' ? '⋯' : '●'}
    </span>
  )

  const tabBtn = (t: Tab, label: string, badge?: number, icon?: React.ReactNode): React.ReactNode => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding:      '10px 20px',
        border:       'none',
        borderBottom: tab === t ? '2px solid #4f46e5' : '2px solid transparent',
        marginBottom: -2,
        background:   'none',
        cursor:       'pointer',
        fontWeight:   tab === t ? 600 : 400,
        fontSize:     14,
        color:        tab === t ? '#4f46e5' : '#6b7280',
        display:      'flex',
        alignItems:   'center',
        gap:          6,
      }}
    >
      {icon}
      {label}
      {badge != null && badge > 0 && (
        <span style={{
          background:   tab === t ? '#4f46e5' : '#e5e7eb',
          color:        tab === t ? '#fff'    : '#6b7280',
          borderRadius: 999,
          fontSize:     11,
          fontWeight:   600,
          padding:      '1px 6px',
        }}>
          {badge}
        </span>
      )}
    </button>
  )

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        {tabBtn('attendance', 'Attendance')}
        {tabBtn('lineup', 'Lineup', confirmedCount, saveIcon)}
      </div>

      {/* Both panels stay mounted — CSS toggled to preserve timer state */}
      <div style={{ display: tab === 'attendance' ? 'block' : 'none' }}>
        <AttendancePanel
          gameId={gameId}
          initialPlayers={allPlayers}
          attendance={attendance}
          onSet={handleSet}
          gameStatus={gameStatus}
        />
      </div>
      <div className="full-bleed" style={{ display: tab === 'lineup' ? 'block' : 'none' }}>
        <LineupEditorWrapper
          gameId={gameId}
          players={confirmedPlayers}
          lineup={savedLineup}
          onPlayerBenched={ids => ids.forEach(id => handleSet(id, 'out'))}
          onSaveStatusChange={setSaveStatus}
        />
      </div>
    </div>
  )
}
