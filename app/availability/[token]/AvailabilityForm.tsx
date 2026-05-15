'use client'

import { useState } from 'react'
import type { AttendanceStatus } from '@/db/schema'
import type { AttendanceCounts } from '@/lib/availability'
import { buildGoogleCalendarUrl } from '@/lib/player-links'

export type GameRow = {
  gameId:       string
  date:         string
  time:         string
  location:     string
  homeOrAway:   'home' | 'away'
  opponentName: string
  attendance:   AttendanceStatus | null
  note:         string | null
  counts:       AttendanceCounts
}

export type SeasonSection = {
  seasonName: string
  games:      GameRow[]
}

export default function AvailabilityForm({
  token,
  playerName,
  seasons,
}: {
  token:      string
  playerName: string
  seasons:    SeasonSection[]
}) {
  const allGames = seasons.flatMap(s => s.games)

  const [pending, setPending] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(allGames.map(g => [g.gameId, g.attendance ?? 'unknown']))
  )
  const [notes,  setNotes]  = useState<Record<string, string>>(
    Object.fromEntries(allGames.map(g => [g.gameId, g.note ?? '']))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saved,  setSaved]  = useState<Record<string, boolean>>({})

  async function saveGame(gameId: string, status: AttendanceStatus, note: string) {
    setSaving(prev => ({ ...prev, [gameId]: true }))
    setSaved(prev => ({ ...prev, [gameId]: false }))
    await fetch(`/api/availability/${token}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ updates: [{ gameId, attendance: status, note: note.trim() || null }] }),
    })
    setSaving(prev => ({ ...prev, [gameId]: false }))
    setSaved(prev => ({ ...prev, [gameId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [gameId]: false })), 2000)
  }

  async function handleStatusClick(gameId: string, status: AttendanceStatus) {
    setPending(prev => ({ ...prev, [gameId]: status }))
    await saveGame(gameId, status, notes[gameId] ?? '')
  }

  async function handleNoteSave(gameId: string) {
    await saveGame(gameId, pending[gameId], notes[gameId] ?? '')
  }

  const firstName = playerName.split(' ')[0]

  if (seasons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: '#6b7280' }}>
        <p style={{ fontSize: 18, marginBottom: 8 }}>Hi, {firstName}!</p>
        <p>No upcoming games scheduled.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Check back later!</p>
      </div>
    )
  }

  const subtitle = seasons.length === 1
    ? <>Let us know which games you can make — <strong>{seasons[0].seasonName}</strong></>
    : <>Let us know which games you can make.</>

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Hi, {firstName}!</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {seasons.map(season => (
          <div key={season.seasonName}>
            {seasons.length > 1 && (
              <h2 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                {season.seasonName}
              </h2>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {season.games.map(g => {
                const status   = pending[g.gameId] ?? 'unknown'
                const isSaving = saving[g.gameId] ?? false
                const isSaved  = saved[g.gameId]  ?? false
                const gameDate = new Date(g.date + 'T12:00:00')
                const [h, m]   = g.time.split(':').map(Number)
                const timeStr  = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
                const gcalUrl  = buildGoogleCalendarUrl({
                  date:     g.date,
                  time:     g.time,
                  title:    `${season.seasonName} ${g.homeOrAway === 'home' ? 'vs' : '@'} ${g.opponentName}`,
                  location: g.location,
                })

                return (
                  <div key={g.gameId} style={{
                    background:   '#fff',
                    border:       `2px solid ${status === 'confirmed' ? '#16a34a' : status === 'out' ? '#dc2626' : status === 'maybe' ? '#d97706' : '#e5e7eb'}`,
                    borderRadius: 12,
                    padding:      '16px',
                    transition:   'border-color 0.15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>
                          {gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 8 }}>{timeStr}</span>
                        </div>
                        <div style={{ fontSize: 14, color: '#374151' }}>
                          {g.homeOrAway === 'home' ? 'vs' : '@'} {g.opponentName}
                        </div>
                        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{g.location}</div>
                        <a
                          href={gcalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 12, color: '#4f46e5', textDecoration: 'none' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                            <line x1="16" x2="16" y1="2" y2="6"/>
                            <line x1="8" x2="8" y1="2" y2="6"/>
                            <line x1="3" x2="21" y1="10" y2="10"/>
                          </svg>
                          Add to Google Calendar
                        </a>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {([
                          { label: 'In',    count: g.counts.confirmed, color: '#166534', bg: '#dcfce7' },
                          { label: 'Maybe', count: g.counts.maybe,     color: '#92400e', bg: '#fef3c7' },
                          { label: 'Out',   count: g.counts.out,       color: '#991b1b', bg: '#fee2e2' },
                        ] as const).map(s => (
                          <div key={s.label} style={{ background: s.bg, borderRadius: 6, padding: '6px 12px', textAlign: 'center', minWidth: 54 }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.count}</div>
                            <div style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status buttons — submit immediately */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: status !== 'unknown' ? 10 : 0 }}>
                      {([
                        { value: 'confirmed' as const, label: "✓ I'm In",        activeColor: '#16a34a' },
                        { value: 'maybe'     as const, label: '~ Maybe',          activeColor: '#d97706' },
                        { value: 'out'       as const, label: "✗ Can't Make It", activeColor: '#dc2626' },
                      ]).map(btn => (
                        <button
                          key={btn.value}
                          onClick={() => handleStatusClick(g.gameId, btn.value)}
                          disabled={isSaving}
                          style={{
                            flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                            cursor:     isSaving ? 'default' : 'pointer',
                            border:     'none',
                            background: status === btn.value ? btn.activeColor : '#f3f4f6',
                            color:      status === btn.value ? '#fff'          : '#374151',
                            opacity:    isSaving ? 0.6 : 1,
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Saved confirmation */}
                    {isSaved && (
                      <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 8, textAlign: 'center' }}>
                        ✓ Saved
                      </div>
                    )}

                    {/* Note section — only visible after a selection is made */}
                    {status !== 'unknown' && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <textarea
                          value={notes[g.gameId] ?? ''}
                          onChange={e => setNotes(prev => ({ ...prev, [g.gameId]: e.target.value }))}
                          placeholder="Add a note… (optional)"
                          rows={2}
                          style={{
                            flex: 1, borderRadius: 8, border: '1px solid #e5e7eb',
                            padding: '8px 10px', fontSize: 13, color: '#374151',
                            resize: 'vertical', minWidth: 0,
                          }}
                        />
                        <button
                          onClick={() => handleNoteSave(g.gameId)}
                          disabled={isSaving}
                          style={{
                            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor:     isSaving ? 'default' : 'pointer',
                            border:     'none',
                            background: '#e5e7eb',
                            color:      '#374151',
                            opacity:    isSaving ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            alignSelf:  'flex-end',
                          }}
                        >
                          {isSaving ? 'Saving…' : 'Save Note'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
