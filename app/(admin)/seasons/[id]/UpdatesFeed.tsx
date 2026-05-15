import type { ActivityLogEntry, ActivityEventType } from '@/db/schema'

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtTimestamp(d: Date | null) {
  if (!d) return ''
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'In',
  maybe:     'Maybe',
  out:       'Out',
  unknown:   'No response',
}

const STATUS_COLOR: Record<string, string> = {
  confirmed: '#166534',
  maybe:     '#92400e',
  out:       '#991b1b',
  unknown:   '#6b7280',
}

function eventIcon(type: ActivityEventType) {
  switch (type) {
    case 'availability_updated':
    case 'attendance_updated':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <polyline points="16 11 18 13 22 9"/>
        </svg>
      )
    case 'score_recorded':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      )
    case 'game_added':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
          <line x1="12" x2="12" y1="14" y2="18"/>
          <line x1="10" x2="14" y1="16" y2="16"/>
        </svg>
      )
    case 'game_cancelled':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
          <line x1="9" x2="15" y1="14" y2="20"/>
          <line x1="15" x2="9" y1="14" y2="20"/>
        </svg>
      )
    case 'game_rescheduled':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/>
          <path d="M16 2v4"/>
          <path d="M8 2v4"/>
          <path d="M3 10h5"/>
          <path d="M17.5 17.5 16 16.3V14"/>
          <circle cx="16" cy="16" r="6"/>
        </svg>
      )
    case 'ringer_added':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" x2="19" y1="8" y2="14"/>
          <line x1="22" x2="16" y1="11" y2="11"/>
        </svg>
      )
  }
}

function eventDescription(entry: ActivityLogEntry): React.ReactNode {
  const p = entry.payload as Record<string, unknown>

  switch (entry.eventType) {
    case 'availability_updated': {
      const s      = String(p.status ?? '')
      const status = STATUS_LABEL[s] ?? s
      const color  = STATUS_COLOR[s] ?? '#374151'
      const note   = p.note ? String(p.note).trim() : ''
      return (
        <>
          <strong>{String(p.playerName ?? '')}</strong> marked themselves as{' '}
          <strong style={{ color }}>{status}</strong>{' '}
          for the {fmtDate(String(p.gameDate ?? ''))} game vs {String(p.opponentName ?? '')}
          {note && <><br /><span style={{ color: '#6b7280', fontStyle: 'italic' }}>&ldquo;{note}&rdquo;</span></>}
        </>
      )
    }
    case 'attendance_updated': {
      const s      = String(p.status ?? '')
      const status = STATUS_LABEL[s] ?? s
      const color  = STATUS_COLOR[s] ?? '#374151'
      return (
        <>
          <strong>{String(p.playerName ?? '')}</strong> marked as{' '}
          <strong style={{ color }}>{status}</strong>{' '}
          for the {fmtDate(String(p.gameDate ?? ''))} game vs {String(p.opponentName ?? '')}
        </>
      )
    }
    case 'score_recorded': {
      const us     = Number(p.ourScore)
      const them   = Number(p.opponentScore)
      const result = us > them ? 'W' : us < them ? 'L' : 'T'
      const color  = us > them ? '#166534' : us < them ? '#991b1b' : '#374151'
      return (
        <>
          Score recorded:{' '}
          <strong style={{ color }}>{us}–{them} {result}</strong>{' '}
          vs {String(p.opponentName ?? '')} ({fmtDate(String(p.gameDate ?? ''))})
        </>
      )
    }
    case 'game_added': {
      const timeStr = p.time ? fmtTime(String(p.time)) : ''
      return (
        <>
          New game scheduled: {fmtDate(String(p.date ?? ''))} at {timeStr} —{' '}
          {p.homeOrAway === 'home' ? 'vs' : '@'} {String(p.opponentName ?? '')} at {String(p.location ?? '')}
        </>
      )
    }
    case 'game_cancelled':
      return (
        <>
          Game vs <strong>{String(p.opponentName ?? '')}</strong> ({fmtDate(String(p.gameDate ?? ''))}) was cancelled
        </>
      )
    case 'game_rescheduled': {
      const parts: string[] = []
      if (p.oldDate && p.newDate) parts.push(`date from ${fmtDate(String(p.oldDate))} to ${fmtDate(String(p.newDate))}`)
      if (p.oldTime && p.newTime) parts.push(`time from ${fmtTime(String(p.oldTime))} to ${fmtTime(String(p.newTime))}`)
      if (p.oldLocation && p.newLocation) parts.push(`location from ${String(p.oldLocation)} to ${String(p.newLocation)}`)
      return (
        <>
          Game vs <strong>{String(p.opponentName ?? '')}</strong> rescheduled
          {parts.length > 0 ? ` — ${parts.join(', ')}` : ''}
        </>
      )
    }
    case 'ringer_added':
      return (
        <>
          <strong>{String(p.playerName ?? '')}</strong> added to roster as a ringer
        </>
      )
  }
}

function iconColor(type: ActivityEventType) {
  switch (type) {
    case 'availability_updated': return '#4f46e5'
    case 'attendance_updated':   return '#0369a1'
    case 'score_recorded':       return '#166534'
    case 'game_added':           return '#0369a1'
    case 'game_cancelled':       return '#991b1b'
    case 'game_rescheduled':     return '#92400e'
    case 'ringer_added':         return '#0369a1'
  }
}

export default function UpdatesFeed({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
        No updates yet. Activity will appear here as players respond and games are updated.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {entries.map((entry, i) => (
        <div
          key={entry.id}
          style={{
            display:      'flex',
            gap:          12,
            padding:      '12px 0',
            borderBottom: i < entries.length - 1 ? '1px solid #f3f4f6' : 'none',
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: iconColor(entry.eventType),
            marginTop: 1,
          }}>
            {eventIcon(entry.eventType)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.5 }}>
              {eventDescription(entry)}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {fmtTimestamp(entry.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
