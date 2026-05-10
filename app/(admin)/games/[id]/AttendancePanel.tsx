'use client'

import { useRef, useState } from 'react'
import PlayerName from '@/components/PlayerName'
import type { AttendanceStatus, Position } from '@/db/schema'

export type AttendanceRow = {
  playerId:           string
  name:               string
  jerseyNumber:       string | null
  preferredPositions: Position[]
  attendance:         AttendanceStatus
  note:               string | null
  email:              string | null
  whatsapp:           string | null
  mailtoBody:         string | null
  whatsappBody:       string | null
}

export default function AttendancePanel({
  gameId,
  initialPlayers,
  attendance,
  onSet,
  gameStatus,
  mailtoSubject,
}: {
  gameId:          string
  initialPlayers:  AttendanceRow[]
  attendance:      Record<string, AttendanceStatus>
  onSet:           (playerId: string, status: AttendanceStatus) => void
  gameStatus:      string
  mailtoSubject?:  string
}) {
  const isCancelled = gameStatus === 'cancelled'

  function setStatus(playerId: string, status: AttendanceStatus) {
    if (isCancelled) return
    onSet(playerId, status)
  }

  const byStatus = (s: AttendanceStatus) =>
    initialPlayers
      .filter(p => attendance[p.playerId] === s)
      .sort((a, b) => a.name.localeCompare(b.name))

  const unknown   = byStatus('unknown')
  const confirmed = byStatus('confirmed')
  const maybe     = byStatus('maybe')
  const out       = byStatus('out')

  const total = initialPlayers.length

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Confirmed', count: confirmed.length, color: '#166534', bg: '#dcfce7' },
          { label: 'Maybe',     count: maybe.length,     color: '#92400e', bg: '#fef3c7' },
          { label: 'Out',       count: out.length,       color: '#991b1b', bg: '#fee2e2' },
          { label: 'Unknown',   count: unknown.length,   color: '#374151', bg: '#f3f4f6' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '10px 20px', textAlign: 'center', minWidth: 90 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
        <div style={{ background: '#f3f4f6', borderRadius: 8, padding: '10px 20px', textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>{total}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Rostered</div>
        </div>
      </div>

      {isCancelled && (
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 16 }}>
          This game is cancelled. Attendance cannot be modified.
        </p>
      )}

      {/* Pending response */}
      {unknown.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            No Response ({unknown.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unknown.map(p => (
              <PlayerRow
                key={p.playerId}
                player={p}
                current="unknown"
                onSet={status => setStatus(p.playerId, status)}
                disabled={isCancelled}
                gameId={gameId}
                mailtoSubject={mailtoSubject}
              />
            ))}
          </div>
        </section>
      )}

      {/* Confirmed */}
      {confirmed.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Confirmed ({confirmed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {confirmed.map(p => (
              <PlayerRow
                key={p.playerId}
                player={p}
                current="confirmed"
                onSet={status => setStatus(p.playerId, status)}
                disabled={isCancelled}
                gameId={gameId}
                mailtoSubject={mailtoSubject}
              />
            ))}
          </div>
        </section>
      )}

      {/* Maybe */}
      {maybe.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Maybe ({maybe.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {maybe.map(p => (
              <PlayerRow
                key={p.playerId}
                player={p}
                current="maybe"
                onSet={status => setStatus(p.playerId, status)}
                disabled={isCancelled}
                gameId={gameId}
                mailtoSubject={mailtoSubject}
              />
            ))}
          </div>
        </section>
      )}

      {/* Out */}
      {out.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Out ({out.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {out.map(p => (
              <PlayerRow
                key={p.playerId}
                player={p}
                current="out"
                onSet={status => setStatus(p.playerId, status)}
                disabled={isCancelled}
                gameId={gameId}
                mailtoSubject={mailtoSubject}
              />
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          No players on this game&apos;s roster. Add players to the season roster first.
        </p>
      )}
    </div>
  )
}

function PlayerRow({
  player,
  current,
  onSet,
  disabled,
  gameId,
  mailtoSubject,
}: {
  player:         AttendanceRow
  current:        AttendanceStatus
  onSet:          (s: AttendanceStatus) => void
  disabled:       boolean
  gameId:         string
  mailtoSubject?: string
}) {
  const btnStyle = (active: boolean, activeColor: string): React.CSSProperties => ({
    padding:      '4px 10px',
    borderRadius: 6,
    fontSize:     13,
    fontWeight:   active ? 600 : 400,
    cursor:       disabled ? 'default' : 'pointer',
    border:       active ? 'none' : '1px solid #d1d5db',
    background:   active ? activeColor : '#fff',
    color:        active ? '#fff' : '#6b7280',
    opacity:      disabled ? 0.6 : 1,
  })

  return (
    <div style={{
      padding:      '8px 12px',
      background:   '#fafafa',
      borderRadius: 8,
      border:       '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 32, color: '#9ca3af', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>
          {player.jerseyNumber ? `#${player.jerseyNumber}` : ''}
        </span>
        <span style={{ flex: 1 }}>
          <PlayerName name={player.name} email={player.email} mailtoSubject={mailtoSubject} mailtoBody={player.mailtoBody ?? undefined} whatsapp={player.whatsapp} whatsappSubject={mailtoSubject} whatsappBody={player.whatsappBody ?? undefined} clipboardText={player.whatsappBody ?? undefined} />
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btnStyle(current === 'confirmed', '#16a34a')} onClick={() => onSet('confirmed')} disabled={disabled}>
            In
          </button>
          <button style={btnStyle(current === 'maybe', '#d97706')} onClick={() => onSet('maybe')} disabled={disabled}>
            Maybe
          </button>
          <button style={btnStyle(current === 'out', '#dc2626')} onClick={() => onSet('out')} disabled={disabled}>
            Out
          </button>
          {current !== 'unknown' && (
            <button style={btnStyle(false, '#6b7280')} onClick={() => onSet('unknown')} disabled={disabled}>
              ?
            </button>
          )}
        </div>
      </div>
      <NoteInput
        playerId={player.playerId}
        gameId={gameId}
        initial={player.note}
        disabled={disabled}
      />
    </div>
  )
}

function NoteInput({
  playerId,
  gameId,
  initial,
  disabled,
}: {
  playerId: string
  gameId:   string
  initial:  string | null
  disabled: boolean
}) {
  const [value,   setValue]   = useState(initial ?? '')
  const savedRef              = useRef(initial ?? '')

  async function handleBlur() {
    const trimmed = value.trim()
    if (trimmed === savedRef.current) return
    savedRef.current = trimmed
    await fetch(`/api/games/${gameId}/attendance`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ updates: [{ playerId, note: trimmed || null }] }),
    })
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="Add note…"
      style={{
        display:      'block',
        width:        '100%',
        marginTop:    6,
        marginLeft:   44,
        boxSizing:    'border-box',
        border:       'none',
        borderBottom: '1px solid transparent',
        background:   'transparent',
        fontSize:     12,
        color:        '#6b7280',
        padding:      '2px 0',
        outline:      'none',
        cursor:       'text',
        minWidth:     0,
      }}
      onFocus={e => { e.currentTarget.style.borderBottomColor = '#d1d5db' }}
      onBlurCapture={e => { e.currentTarget.style.borderBottomColor = 'transparent'; handleBlur() }}
    />
  )
}
