import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq, asc, inArray } from 'drizzle-orm'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { seasons, games, opponents, gamePlayers, players } from '@/db/schema'
import { createGameWithRoster } from '@/lib/games'
import type { HomeOrAway } from '@/db/schema'
import ExportButton from './ExportButton'


function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export default async function SeasonPage({ params }: { params: { id: string } }) {
  await requireSession()

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

  const allOpponents = await db.select().from(opponents).orderBy(asc(opponents.name)).all()

  // Attendance summary per game
  const gameIds = gameRows.map(g => g.id)
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
  const completed = gameRows.filter(g => g.status === 'completed')
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

  async function editSeason(data: FormData) {
    'use server'
    const name      = (data.get('name')      as string).trim()
    const startDate = (data.get('startDate') as string).trim()
    const endDate   = (data.get('endDate')   as string).trim()
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0 }}>{season.name}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            {new Date(season.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            {' – '}
            {new Date(season.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <ExportButton seasonId={params.id} seasonName={season.name} />
          <Link href={`/seasons/${params.id}/roster`} className="btn btn-secondary btn-sm">Manage Roster</Link>
        </div>
      </div>

      {/* Edit season */}
      <details className="card mb-4">
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>Edit Season</summary>
        <form action={editSeason} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="season-name">Name *</label>
              <input id="season-name" name="name" type="text" required defaultValue={season.name} />
            </div>
            <div className="field">
              <label htmlFor="season-start">Start Date *</label>
              <input id="season-start" name="startDate" type="date" required defaultValue={season.startDate} />
            </div>
            <div className="field">
              <label htmlFor="season-end">End Date *</label>
              <input id="season-end" name="endDate" type="date" required defaultValue={season.endDate} />
            </div>
          </div>
          <div>
            <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
          </div>
        </form>
      </details>

      {/* Record */}
      {completed.length > 0 && (
        <>
          <div className="card mb-4" style={{ display: 'flex', gap: 32, padding: '16px 24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Wins',   value: wins,   color: '#166534' },
              { label: 'Losses', value: losses, color: '#991b1b' },
              ...(ties > 0 ? [{ label: 'Ties', value: ties, color: '#374151' }] : []),
              { label: 'Games',  value: gameRows.filter(g => g.status !== 'cancelled').length, color: '#374151' },
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
          <div className="card mb-4">
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
        </>
      )}

      {/* Games list */}
      <div className="card">
        {gameRows.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>No games scheduled yet.</p>
        ) : (
          <div>
            {gameRows.map((g, i) => {
              const att = attByGame.get(g.id) ?? { confirmed: [], maybe: [], out: [] }
              const hasAtt = att.confirmed.length + att.maybe.length + att.out.length > 0
              const attCounts: { names: string[]; bg: string; color: string }[] = [
                { names: att.confirmed, bg: '#dcfce7', color: '#166534' },
                { names: att.maybe,     bg: '#fef3c7', color: '#92400e' },
                { names: att.out,       bg: '#fee2e2', color: '#991b1b' },
              ]
              return (
                <details
                  key={g.id}
                  className="game-row"
                  style={{
                    borderBottom: i < gameRows.length - 1 ? '1px solid #e5e7eb' : 'none',
                    opacity:      g.status === 'cancelled' ? 0.5 : 1,
                  }}
                >
                  <summary>
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
                  </summary>
                  <div className="game-row-body">
                    {hasAtt ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 10 }}>
                        {attCounts.map(({ names, color }) => names.map(name => (
                          <span key={name} style={{ fontSize: 13, color }}>{name}</span>
                        )))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>No responses yet.</p>
                    )}
                    <Link href={`/games/${g.id}`} className="btn btn-secondary btn-sm">
                      View Game →
                    </Link>
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>

      {/* Add game */}
      {allOpponents.length === 0 ? (
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
      )}
    </>
  )
}
