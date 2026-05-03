import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { games, opponents, seasons, gamePlayers, players, lineupEntries } from '@/db/schema'
import GameDetail from './GameDetail'
import type { AttendanceRow } from './AttendancePanel'
import type { LineupEntry } from '@/components/lineup-editor-wrapper'

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default async function GamePage({ params }: { params: { id: string } }) {
  await requireSession()

  const game = await db
    .select({
      id:            games.id,
      date:          games.date,
      time:          games.time,
      location:      games.location,
      homeOrAway:    games.homeOrAway,
      status:        games.status,
      ourScore:      games.ourScore,
      opponentScore: games.opponentScore,
      seasonId:      games.seasonId,
      opponentName:  opponents.name,
      seasonName:    seasons.name,
    })
    .from(games)
    .innerJoin(opponents, eq(games.opponentId, opponents.id))
    .innerJoin(seasons,   eq(games.seasonId,   seasons.id))
    .where(eq(games.id, params.id))
    .get()

  if (!game) notFound()
  const gameRow = game

  const attendanceRows: AttendanceRow[] = await db
    .select({
      playerId:           players.id,
      name:               players.name,
      jerseyNumber:       players.jerseyNumber,
      preferredPositions: players.preferredPositions,
      attendance:         gamePlayers.attendance,
      note:               gamePlayers.note,
    })
    .from(gamePlayers)
    .innerJoin(players, eq(gamePlayers.playerId, players.id))
    .where(eq(gamePlayers.gameId, params.id))
    .orderBy(players.name)
    .all()

  const savedLineup: LineupEntry[] = (await db
    .select({
      playerId:     lineupEntries.playerId,
      battingOrder: lineupEntries.battingOrder,
      position:     lineupEntries.position,
      lineupStatus: lineupEntries.lineupStatus,
    })
    .from(lineupEntries)
    .where(eq(lineupEntries.gameId, params.id))
    .all())
    .map(e => ({
      playerId:     e.playerId,
      battingOrder: e.battingOrder ?? null,
      position:     e.position ?? null,
      lineupStatus: e.lineupStatus,
    }))

  async function recordResult(data: FormData) {
    'use server'
    const ourScore      = parseInt(data.get('ourScore')      as string, 10)
    const opponentScore = parseInt(data.get('opponentScore') as string, 10)
    if (isNaN(ourScore) || isNaN(opponentScore)) return
    await db.update(games).set({ ourScore, opponentScore, status: 'completed', updatedAt: new Date() })
      .where(eq(games.id, params.id)).run()
    revalidatePath(`/games/${params.id}`)
    revalidatePath(`/seasons/${gameRow.seasonId}`)
  }

  async function revertToScheduled() {
    'use server'
    await db.update(games).set({ status: 'scheduled', ourScore: null, opponentScore: null, updatedAt: new Date() })
      .where(eq(games.id, params.id)).run()
    revalidatePath(`/games/${params.id}`)
    revalidatePath(`/seasons/${gameRow.seasonId}`)
  }

  async function cancelGame() {
    'use server'
    await db.update(games).set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(games.id, params.id)).run()
    revalidatePath(`/games/${params.id}`)
    revalidatePath(`/seasons/${gameRow.seasonId}`)
  }

  const statusBadge = () => {
    if (game.status === 'completed') return <span className="badge badge-green">Final</span>
    if (game.status === 'cancelled') return <span className="badge badge-gray">Cancelled</span>
    return <span className="badge badge-blue">Scheduled</span>
  }

  const isCompleted = game.status === 'completed'

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link href={`/seasons/${game.seasonId}`} style={{ color: '#6b7280', fontSize: 14 }}>
          ← {game.seasonName}
        </Link>
      </div>

      {/* Game header */}
      <div className="card mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 20 }}>
                {game.homeOrAway === 'home' ? 'vs' : '@'} {game.opponentName}
              </h1>
              <span className={`badge ${game.homeOrAway === 'home' ? 'badge-green' : 'badge-gray'}`}>
                {game.homeOrAway === 'home' ? 'Home' : 'Away'}
              </span>
              {statusBadge()}
            </div>
            <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>{fmtDate(game.date)}</span>
              <span>{fmtTime(game.time)}</span>
              <span>{game.location}</span>
            </div>
          </div>

          {isCompleted && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                <span style={{ color: (game.ourScore ?? 0) > (game.opponentScore ?? 0) ? '#166534' : '#991b1b' }}>
                  {game.ourScore}
                </span>
                <span style={{ color: '#d1d5db', margin: '0 8px' }}>–</span>
                <span style={{ color: '#374151' }}>{game.opponentScore}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                {(game.ourScore ?? 0) > (game.opponentScore ?? 0) ? 'Win' :
                 (game.ourScore ?? 0) < (game.opponentScore ?? 0) ? 'Loss' : 'Tie'}
              </div>
            </div>
          )}
        </div>
      </div>

      <GameDetail
        gameId={params.id}
        gameStatus={game.status}
        allPlayers={attendanceRows}
        savedLineup={savedLineup}
      />

      {/* Record / edit result */}
      {game.status !== 'cancelled' && (
        <div className="card mt-4">
          {isCompleted ? (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Edit Score</summary>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <form action={recordResult} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: '0 0 auto' }}>
                    <label>Our Score</label>
                    <input name="ourScore" type="number" min="0" required defaultValue={game.ourScore ?? 0}
                      style={{ width: 80 }} />
                  </div>
                  <div className="field" style={{ flex: '0 0 auto' }}>
                    <label>Their Score</label>
                    <input name="opponentScore" type="number" min="0" required defaultValue={game.opponentScore ?? 0}
                      style={{ width: 80 }} />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">Update</button>
                </form>
                <form action={revertToScheduled}>
                  <button type="submit" className="btn btn-secondary btn-sm">Revert to Scheduled</button>
                </form>
              </div>
            </details>
          ) : (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>+ Record Final Score</summary>
              <form action={recordResult} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '0 0 auto' }}>
                  <label>Our Score</label>
                  <input name="ourScore" type="number" min="0" required defaultValue={0} style={{ width: 80 }} />
                </div>
                <div className="field" style={{ flex: '0 0 auto' }}>
                  <label>Their Score</label>
                  <input name="opponentScore" type="number" min="0" required defaultValue={0} style={{ width: 80 }} />
                </div>
                <button type="submit" className="btn btn-primary">Mark as Final</button>
              </form>
            </details>
          )}
        </div>
      )}

      {game.status === 'scheduled' && (
        <div className="card mt-4">
          <form action={cancelGame}>
            <button type="submit" className="btn btn-danger btn-sm">Cancel Game</button>
          </form>
        </div>
      )}
    </>
  )
}
