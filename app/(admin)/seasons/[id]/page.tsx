import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, asc, inArray, desc } from 'drizzle-orm'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { seasons, games, opponents, gamePlayers, players, seasonRoster, activityLog } from '@/db/schema'
import { createGameWithRoster } from '@/lib/games'
import type { HomeOrAway } from '@/db/schema'
import ExportButton from './ExportButton'
import UpdatesFeed from './UpdatesFeed'
import SeasonHeader from './SeasonHeader'
import RosterPanel from './RosterPanel'


function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export default async function SeasonPage({
  params,
  searchParams,
}: {
  params:       { id: string }
  searchParams?: { tab?: string }
}) {
  const rawTab = searchParams?.tab
  const tab: 'schedule' | 'roster' | 'updates' = rawTab === 'updates' || rawTab === 'roster' ? rawTab : 'schedule'
  const session = await requireSession()
  const isAdmin = session.user.role === 'admin'

  const season = await db.select().from(seasons).where(eq(seasons.id, params.id)).get()
  if (!season) notFound()

  const gameRows = await db
    .select({
      id:            games.id,
      date:          games.date,
      time:          games.time,
      location:      games.location,
      status:        games.status,
      ourScore:      games.ourScore,
      opponentScore: games.opponentScore,
      opponentName:  opponents.name,
    })
    .from(games)
    .innerJoin(opponents, eq(games.opponentId, opponents.id))
    .where(eq(games.seasonId, params.id))
    .orderBy(asc(games.date))
    .all()

  const visibleGameRows = gameRows.filter(g => g.status !== 'removed')
  const removedGameRows = gameRows.filter(g => g.status === 'removed')

  const allOpponents = await db.select().from(opponents).orderBy(asc(opponents.name)).all()

  const feedEntries = tab === 'updates'
    ? await db.select().from(activityLog)
        .where(eq(activityLog.seasonId, params.id))
        .orderBy(desc(activityLog.createdAt))
        .limit(200)
        .all()
    : []

  const headersList = headers()
  const host   = headersList.get('host') ?? 'localhost:3000'
  const proto  = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const availabilityBaseUrl = `${proto}://${host}`

  const rosterData = tab === 'roster'
    ? await Promise.all([
        db.select({ id: players.id, name: players.name, jerseyNumber: players.jerseyNumber, preferredPositions: players.preferredPositions, email: players.email, whatsapp: players.whatsapp, availabilityToken: players.availabilityToken })
          .from(players)
          .where(eq(players.isActive, true))
          .all(),
        db.select({ playerId: seasonRoster.playerId })
          .from(seasonRoster)
          .where(eq(seasonRoster.seasonId, params.id))
          .all(),
      ])
    : null

  const allActivePlayers = rosterData
    ? rosterData[0].sort((a, b) => {
        const aNum = a.jerseyNumber !== null ? Number(a.jerseyNumber) : NaN
        const bNum = b.jerseyNumber !== null ? Number(b.jerseyNumber) : NaN
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
        if (!isNaN(aNum)) return -1
        if (!isNaN(bNum)) return 1
        return a.name.localeCompare(b.name)
      })
    : []

  const rosterPlayerIds = rosterData ? rosterData[1].map(r => r.playerId) : []

  // Attendance summary per game (visible games only)
  const gameIds = visibleGameRows.map(g => g.id)
  const attendanceRows = gameIds.length > 0
    ? await db
        .select({
          gameId:     gamePlayers.gameId,
          playerName: players.name,
          attendance: gamePlayers.attendance,
        })
        .from(gamePlayers)
        .innerJoin(players, eq(gamePlayers.playerId, players.id))
        .where(inArray(gamePlayers.gameId, gameIds))
        .orderBy(asc(players.name))
        .all()
    : []

  type AttSummary = { confirmed: string[]; maybe: string[]; out: string[] }
  const attByGame = new Map<string, AttSummary>()
  for (const row of attendanceRows) {
    if (!attByGame.has(row.gameId)) attByGame.set(row.gameId, { confirmed: [], maybe: [], out: [] })
    const s = attByGame.get(row.gameId)!
    if      (row.attendance === 'confirmed') s.confirmed.push(row.playerName)
    else if (row.attendance === 'maybe')     s.maybe.push(row.playerName)
    else if (row.attendance === 'out')       s.out.push(row.playerName)
  }

  // W / L / T / run diff from completed games
  const completed = visibleGameRows.filter(g => g.status === 'completed')
  const wins    = completed.filter(g => (g.ourScore ?? 0) > (g.opponentScore ?? 0)).length
  const losses  = completed.filter(g => (g.ourScore ?? 0) < (g.opponentScore ?? 0)).length
  const ties    = completed.filter(g => (g.ourScore ?? 0) === (g.opponentScore ?? 0)).length
  const runDiff = completed.reduce((acc, g) => acc + (g.ourScore ?? 0) - (g.opponentScore ?? 0), 0)

  // Per-opponent record
  const opponentRecords = Object.values(
    completed.reduce((acc, g) => {
      if (!acc[g.opponentName]) acc[g.opponentName] = { name: g.opponentName, w: 0, l: 0, t: 0 }
      const r = acc[g.opponentName]
      if      ((g.ourScore ?? 0) > (g.opponentScore ?? 0)) r.w++
      else if ((g.ourScore ?? 0) < (g.opponentScore ?? 0)) r.l++
      else                                                  r.t++
      return acc
    }, {} as Record<string, { name: string; w: number; l: number; t: number }>)
  ).sort((a, b) => a.name.localeCompare(b.name))

  async function editSeason(name: string, startDate: string, endDate: string) {
    'use server'
    if (!name || !startDate || !endDate) return
    await db.update(seasons).set({ name, startDate, endDate, updatedAt: new Date() })
      .where(eq(seasons.id, params.id)).run()
    revalidatePath(`/seasons/${params.id}`)
    revalidatePath('/seasons')
  }

  async function addGame(data: FormData) {
    'use server'
    const opponentId = data.get('opponentId') as string
    const date       = data.get('date')       as string
    const time       = data.get('time')       as string
    const location   = (data.get('location') as string).trim()
    const homeOrAway = data.get('homeOrAway') as HomeOrAway
    if (!opponentId || !date || !time || !location || !homeOrAway) return

    await createGameWithRoster({
      seasonId: params.id,
      opponentId,
      date,
      time,
      location,
      homeOrAway,
      ourScore:      null,
      opponentScore: null,
      status:        'scheduled',
    })

    revalidatePath(`/seasons/${params.id}`)
  }

  const statusCell = (g: typeof gameRows[0]) => {
    if (g.status === 'cancelled') return <span className="badge badge-gray">Cancelled</span>
    if (g.status === 'completed') {
      const win  = (g.ourScore ?? 0) > (g.opponentScore ?? 0)
      const lose = (g.ourScore ?? 0) < (g.opponentScore ?? 0)
      return (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span className="badge badge-green">Final</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: win ? '#166534' : lose ? '#991b1b' : '#374151' }}>
            {g.ourScore}–{g.opponentScore} {win ? 'W' : lose ? 'L' : 'T'}
          </span>
        </span>
      )
    }
    return <span className="badge badge-blue">Scheduled</span>
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href="/seasons" style={{ color: '#6b7280', fontSize: 14 }}>← Seasons</Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
        <SeasonHeader
          initialName={season.name}
          initialStartDate={season.startDate}
          initialEndDate={season.endDate}
          onSave={editSeason}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
          <ExportButton seasonId={params.id} seasonName={season.name} />
        </div>
      </div>

      {/* Record */}
      {completed.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="card" style={{ display: 'flex', gap: 32, padding: '16px 24px', flexWrap: 'wrap', flex: '1 1 260px' }}>
            {[
              { label: 'Wins',   value: wins,   color: '#166534' },
              { label: 'Losses', value: losses, color: '#991b1b' },
              ...(ties > 0 ? [{ label: 'Ties', value: ties, color: '#374151' }] : []),
              { label: 'Games',  value: visibleGameRows.filter(g => g.status !== 'cancelled').length, color: '#374151' },
              {
                label: 'Run Diff',
                value: (runDiff > 0 ? '+' : '') + runDiff,
                color: runDiff > 0 ? '#166534' : runDiff < 0 ? '#991b1b' : '#374151',
              },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Per-opponent breakdown */}
          <div className="card" style={{ flex: '1 1 260px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Record by Opponent</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
              {opponentRecords.map(r => (
                <div key={r.name} style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#374151' }}>{r.name}</span>
                  <span style={{ fontWeight: 600, color: r.w > r.l ? '#166534' : r.l > r.w ? '#991b1b' : '#374151' }}>
                    {r.w}–{r.l}{r.t > 0 ? `–${r.t}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e5e7eb' }}>
        {([
          { label: 'Schedule', value: 'schedule', href: `/seasons/${params.id}` },
          { label: 'Roster',   value: 'roster',   href: `/seasons/${params.id}?tab=roster` },
          { label: 'Updates',  value: 'updates',  href: `/seasons/${params.id}?tab=updates` },
        ] as const).map(t => (
          <Link
            key={t.value}
            href={t.href}
            style={{
              padding:       '8px 16px',
              fontSize:       14,
              fontWeight:     tab === t.value ? 600 : 400,
              color:          tab === t.value ? '#4f46e5' : '#6b7280',
              borderBottom:  `2px solid ${tab === t.value ? '#4f46e5' : 'transparent'}`,
              marginBottom:  -2,
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Roster tab */}
      {tab === 'roster' && (
        <RosterPanel
          seasonId={params.id}
          seasonName={season.name}
          availabilityBaseUrl={availabilityBaseUrl}
          allPlayers={allActivePlayers}
          initialRosterIds={rosterPlayerIds}
        />
      )}

      {/* Updates tab */}
      {tab === 'updates' && (
        <div className="card">
          <UpdatesFeed entries={feedEntries} />
        </div>
      )}

      {/* Games list */}
      {tab === 'schedule' && <div className="card">
        {visibleGameRows.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No games scheduled yet.</p>
        ) : (
          <div>
            {visibleGameRows.map((g, i) => {
              const att = attByGame.get(g.id) ?? { confirmed: [], maybe: [], out: [] }
              const hasAtt = att.confirmed.length + att.maybe.length + att.out.length > 0
              const attCounts: { names: string[]; bg: string; color: string }[] = [
                { names: att.confirmed, bg: '#dcfce7', color: '#166534' },
                { names: att.maybe,     bg: '#fef3c7', color: '#92400e' },
                { names: att.out,       bg: '#fee2e2', color: '#991b1b' },
              ]
              return (
                <Link
                  key={g.id}
                  href={`/games/${g.id}`}
                  className="game-row"
                  style={{
                    borderBottom: i < visibleGameRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                    opacity:      g.status === 'cancelled' ? 0.5 : 1,
                  }}
                >
                  <div className="game-row-header">
                    <div style={{ minWidth: 80, flexShrink: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{fmtDate(g.date)}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{fmtTime(g.time)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{g.opponentName}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.location}
                      </div>
                      {hasAtt && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                          {attCounts.map(({ names, bg, color }) => names.length > 0 && (
                            <span key={color} style={{ background: bg, color, borderRadius: 5, padding: '1px 7px', fontSize: 12, fontWeight: 600 }}>
                              {names.length}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      {statusCell(g)}
                    </div>
                  </div>
                  {hasAtt && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 6 }}>
                      {attCounts.map(({ names, color }) => names.map(name => (
                        <span key={name} style={{ fontSize: 13, color }}>{name}</span>
                      )))}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>}

      {/* Removed games (admin-only) */}
      {tab === 'schedule' && isAdmin && removedGameRows.length > 0 && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
            {removedGameRows.length} removed game{removedGameRows.length !== 1 ? 's' : ''}
          </summary>
          <div className="card mt-4">
            {removedGameRows.map((g, i) => (
              <Link
                key={g.id}
                href={`/games/${g.id}`}
                className="game-row"
                style={{
                  borderBottom: i < removedGameRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                  opacity: 0.5,
                }}
              >
                <div className="game-row-header">
                  <div style={{ minWidth: 80, flexShrink: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{fmtDate(g.date)}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{fmtTime(g.time)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{g.opponentName}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.location}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <span className="badge badge-gray">Removed</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </details>
      )}

      {/* Add game */}
      {tab === 'schedule' && (allOpponents.length === 0 ? (
        <div className="card mt-4" style={{ color: '#6b7280', fontSize: 14 }}>
          <Link href="/opponents" style={{ color: '#4f46e5' }}>Add opponents</Link> before scheduling games.
        </div>
      ) : (
        <details className="card mt-4">
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>+ Add Game</summary>
          <form action={addGame} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="opponentId">Opponent *</label>
                <select id="opponentId" name="opponentId" required>
                  <option value="">Select opponent…</option>
                  {allOpponents.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="date">Date *</label>
                <input id="date" name="date" type="date" required />
              </div>
              <div className="field">
                <label htmlFor="time">Time *</label>
                <input id="time" name="time" type="time" required defaultValue="18:30" />
              </div>
            </div>
            <div className="form-row">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="location">Location *</label>
                <input id="location" name="location" type="text" required placeholder="e.g. Riverside Diamond, Field 1" />
              </div>
              <div className="field">
                <label htmlFor="homeOrAway">Home / Away *</label>
                <select id="homeOrAway" name="homeOrAway" required>
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn-primary">Add Game</button>
            </div>
          </form>
        </details>
      ))}
    </>
  )
}
