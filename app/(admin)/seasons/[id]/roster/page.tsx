import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { requireAdmin } from '@/lib/session'
import { db } from '@/db'
import { seasons, seasonRoster, players } from '@/db/schema'

export default async function SeasonRosterPage({ params }: { params: { id: string } }) {
  await requireAdmin()

  const season = db.select().from(seasons).where(eq(seasons.id, params.id)).get()
  if (!season) notFound()

  const rosterRows = db
    .select({ playerId: players.id, name: players.name, jerseyNumber: players.jerseyNumber, preferredPositions: players.preferredPositions })
    .from(seasonRoster)
    .innerJoin(players, eq(seasonRoster.playerId, players.id))
    .where(eq(seasonRoster.seasonId, params.id))
    .all()
    .sort((a, b) => +a.jerseyNumber - +b.jerseyNumber)

  const rosterIds = new Set(rosterRows.map(r => r.playerId))

  const notOnRoster = db
    .select({ id: players.id, name: players.name, jerseyNumber: players.jerseyNumber, preferredPositions: players.preferredPositions })
    .from(players)
    .where(eq(players.isActive, true))
    .all()
    .filter(p => !rosterIds.has(p.id))
    .sort((a, b) => +a.jerseyNumber - +b.jerseyNumber)

  async function addPlayer(data: FormData) {
    'use server'
    const playerId = data.get('playerId') as string
    if (!playerId) return
    db.insert(seasonRoster).values({ seasonId: params.id, playerId, createdAt: new Date() }).run()
    revalidatePath(`/seasons/${params.id}/roster`)
  }

  async function removePlayer(data: FormData) {
    'use server'
    const playerId = data.get('playerId') as string
    db.delete(seasonRoster)
      .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, playerId)))
      .run()
    revalidatePath(`/seasons/${params.id}/roster`)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href={`/seasons/${params.id}`} style={{ color: '#6b7280', fontSize: 14 }}>← {season.name}</Link>
        <h1 style={{ margin: 0 }}>Season Roster</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* On roster */}
        <div className="card">
          <h2>On Roster ({rosterRows.length})</h2>
          {rosterRows.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>No players on this season&apos;s roster yet.</p>
          )}
          <table>
            <tbody>
              {rosterRows.map(p => (
                <tr key={p.playerId}>
                  <td style={{ width: 40, color: '#9ca3af', fontWeight: 600 }}>{p.jerseyNumber}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <form action={removePlayer} style={{ display: 'inline' }}>
                      <input type="hidden" name="playerId" value={p.playerId} />
                      <button type="submit" className="btn btn-danger btn-sm">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Not on roster */}
        <div className="card">
          <h2>Available to Add ({notOnRoster.length})</h2>
          {notOnRoster.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 14 }}>All active players are on this roster.</p>
          )}
          <table>
            <tbody>
              {notOnRoster.map(p => (
                <tr key={p.id}>
                  <td style={{ width: 40, color: '#9ca3af', fontWeight: 600 }}>{p.jerseyNumber}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <form action={addPlayer} style={{ display: 'inline' }}>
                      <input type="hidden" name="playerId" value={p.id} />
                      <button type="submit" className="btn btn-primary btn-sm">Add</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
