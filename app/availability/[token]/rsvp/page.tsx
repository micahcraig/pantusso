import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { lookupPlayerByToken, setAttendance } from '@/lib/availability'
import { db } from '@/db'
import { games, opponents } from '@/db/schema'
import type { AttendanceStatus } from '@/db/schema'

type RsvpStatus = 'confirmed' | 'maybe' | 'out'

const VALID_STATUSES = new Set<string>(['confirmed', 'maybe', 'out'])

const STATUS_DISPLAY: Record<RsvpStatus, { icon: string; headline: string; color: string }> = {
  confirmed: { icon: '✓', headline: "You're in!",      color: '#16a34a' },
  maybe:     { icon: '~', headline: "You're a maybe.", color: '#d97706' },
  out:       { icon: '✗', headline: "You're out.",     color: '#dc2626' },
}

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params:       { token: string }
  searchParams: { game?: string; status?: string }
}) {
  const player = await lookupPlayerByToken(params.token)
  if (!player) notFound()

  const { game: gameId, status } = searchParams

  if (!gameId || !status || !VALID_STATUSES.has(status)) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ maxWidth: 400, width: '100%', background: '#fff', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <p style={{ color: '#dc2626', marginBottom: 16 }}>This link doesn&apos;t look right. It may be expired or incomplete.</p>
          <Link href={`/availability/${params.token}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
            View all upcoming games →
          </Link>
        </div>
      </div>
    )
  }

  const game = await db
    .select({
      date:         games.date,
      time:         games.time,
      location:     games.location,
      homeOrAway:   games.homeOrAway,
      opponentName: opponents.name,
    })
    .from(games)
    .innerJoin(opponents, eq(games.opponentId, opponents.id))
    .where(eq(games.id, gameId))
    .get()

  if (!game) notFound()

  const attendance = status as AttendanceStatus
  await setAttendance(gameId, player.id, attendance)

  const display   = STATUS_DISPLAY[status as RsvpStatus]
  const gameDate  = new Date(game.date + 'T12:00:00')
  const [h, m]    = game.time.split(':').map(Number)
  const timeStr   = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  const dateStr   = gameDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const vsStr     = `${game.homeOrAway === 'home' ? 'vs' : '@'} ${game.opponentName}`
  const firstName = player.name.split(' ')[0]

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{
        maxWidth:     400,
        width:        '100%',
        background:   '#fff',
        borderRadius: 16,
        padding:      '32px 24px',
        textAlign:    'center',
        border:       `2px solid ${display.color}`,
      }}>
        <div style={{ fontSize: 40, color: display.color, marginBottom: 8 }}>{display.icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: display.color, margin: '0 0 20px' }}>
          {display.headline}
        </h1>

        <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: '0 0 4px' }}>{dateStr}</p>
        <p style={{ fontSize: 14, color: '#374151', margin: '0 0 2px' }}>{timeStr} · {vsStr}</p>
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>{game.location}</p>

        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
          Got it, {firstName}! We&apos;ve recorded your response.
        </p>

        <Link
          href={`/availability/${params.token}`}
          style={{
            display:        'inline-block',
            padding:        '10px 24px',
            background:     '#4f46e5',
            color:          '#fff',
            borderRadius:   8,
            fontSize:       14,
            fontWeight:     600,
            textDecoration: 'none',
          }}
        >
          Update other games →
        </Link>
      </div>
    </div>
  )
}
