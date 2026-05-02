'use client'

import { useState } from 'react'
import type { AttendanceStatus } from '@/db/schema'

export type GameRow = {
  gameId:       string
  date:         string
  time:         string
  location:     string
  homeOrAway:   'home' | 'away'
  opponentName: string
  attendance:   AttendanceStatus | null
  note:         string | null
}

export default function AvailabilityForm({
  token,
  playerName,
  seasonName,
  initialGames,
}: {
  token:        string
  playerName:   string
  seasonName:   string | null
  initialGames: GameRow[]
}) {
  const [pending, setPending] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(initialGames.map(g => [g.gameId, g.attendance ?? 'unknown']))
  )
  const [notes,   setNotes]   = useState<Record<string, string>>(
    Object.fromEntries(initialGames.map(g => [g.gameId, g.note ?? '']))
  )
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  function toggle(gameId: string, status: AttendanceStatus) {
    setSaved(false)
    setPending(prev => ({ ...prev, [gameId]: status }))
  }

  function setNote(gameId: string, value: string) {
    setSaved(false)
    setNotes(prev => ({ ...prev, [gameId]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const updates = initialGames.map(g => ({
      gameId:     g.gameId,
      attendance: pending[g.gameId],
      note:       notes[g.gameId]?.trim() || null,
    }))
    await fetch(`/api/availability/${token}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ updates }),
    })
    setSaving(false)
    setSaved(true)
  }

  const firstName = playerName.split(' ')[0]

  if (initialGames.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Hi, {firstName}!</p>
        <p>No upcoming games scheduled{seasonName ? ` for ${seasonName}` : ''}.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Check back later!</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Hi, {firstName}!</h1>
        {seasonName && (
          <p style={{ color: '#6b7280', fontSize: 14 }}>
            Let us know which games you can make — <strong>{seasonName}</strong>
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {initialGames.map(g => {
          const status   = pending[g.gameId] ?? 'unknown'
          const gameDate = new Date(g.date + 'T12:00:00')
          const [h, m]   = g.time.split(':').map(Number)
          const timeStr  = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`

          return (
            <div key={g.gameId} style={{
              background:   '#fff',
              border:       `2px solid ${status === 'confirmed' ? '#16a34a' : status === 'out' ? '#dc2626' : status === 'maybe' ? '#d97706' : '#e5e7eb'}`,
              borderRadius: 12,
              padding:      '16px',
              transition:   'border-color 0.15s',
            }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                  {gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>{timeStr}</span>
                </div>
                <div style={{ fontSize: 14, color: '#374151' }}>
                  {g.homeOrAway === 'home' ? 'vs' : '@'} {g.opponentName}
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{g.location}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggle(g.gameId, 'confirmed')}
                  style={{
                    flex:         1,
                    padding:      '10px 0',
                    borderRadius: 8,
                    fontSize:     14,
                    fontWeight:   600,
                    cursor:       'pointer',
                    border:       'none',
                    background:   status === 'confirmed' ? '#16a34a' : '#f3f4f6',
                    color:        status === 'confirmed' ? '#fff'     : '#374151',
                    transition:   'background 0.15s, color 0.15s',
                  }}
                >
                  ✓ I&apos;m In
                </button>
                <button
                  onClick={() => toggle(g.gameId, 'maybe')}
                  style={{
                    flex:         1,
                    padding:      '10px 0',
                    borderRadius: 8,
                    fontSize:     14,
                    fontWeight:   600,
                    cursor:       'pointer',
                    border:       'none',
                    background:   status === 'maybe' ? '#d97706' : '#f3f4f6',
                    color:        status === 'maybe' ? '#fff'    : '#374151',
                    transition:   'background 0.15s, color 0.15s',
                  }}
                >
                  ~ Maybe
                </button>
                <button
                  onClick={() => toggle(g.gameId, 'out')}
                  style={{
                    flex:         1,
                    padding:      '10px 0',
                    borderRadius: 8,
                    fontSize:     14,
                    fontWeight:   600,
                    cursor:       'pointer',
                    border:       'none',
                    background:   status === 'out' ? '#dc2626' : '#f3f4f6',
                    color:        status === 'out' ? '#fff'    : '#374151',
                    transition:   'background 0.15s, color 0.15s',
                  }}
                >
                  ✗ Can&apos;t Make It
                </button>
              </div>
              <textarea
                value={notes[g.gameId] ?? ''}
                onChange={e => setNote(g.gameId, e.target.value)}
                placeholder="Add a note… (optional)"
                rows={2}
                style={{
                  width:        '100%',
                  borderRadius: 8,
                  border:       '1px solid #e5e7eb',
                  padding:      '8px 10px',
                  fontSize:     13,
                  color:        '#374151',
                  resize:       'vertical',
                  minWidth:     0,
                }}
              />
              </div>
            </div>
          )
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width:        '100%',
          padding:      '14px 0',
          borderRadius: 10,
          fontSize:     16,
          fontWeight:   700,
          cursor:       saving ? 'default' : 'pointer',
          border:       'none',
          background:   saved ? '#16a34a' : '#4f46e5',
          color:        '#fff',
          opacity:      saving ? 0.7 : 1,
          transition:   'background 0.2s',
        }}
      >
        {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save My Availability'}
      </button>
    </div>
  )
}
