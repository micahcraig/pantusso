import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { requireSession } from '@/lib/session'
import { db } from '@/db'
import { seasons, seasonRoster, players, games, gamePlayers } from '@/db/schema'
import PlayerName from '@/components/PlayerName'

export default async function SeasonRosterPage({ params }: { params: { id: string } }) {
  await requireSession()

  const season = await db.select().from(seasons).where(eq(seasons.id, params.id)).get()
  if (!season) notFound()

  const headersList = headers()
  const host    = headersList.get('host') ?? 'localhost:3000'
  const proto   = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${proto}://${host}`

  const rosterRows = (await db
    .select({ playerId: players.id, name: players.name, jerseyNumber: players.jerseyNumber, preferredPositions: players.preferredPositions, email: players.email, whatsapp: players.whatsapp, availabilityToken: players.availabilityToken })
    .from(seasonRoster)
    .innerJoin(players, eq(seasonRoster.playerId, players.id))
    .where(eq(seasonRoster.seasonId, params.id))
    .all())
    .sort((a, b) => a.name.localeCompare(b.name))

  const rosterIds = new Set(rosterRows.map(r => r.playerId))

  const notOnRoster = (await db
    .select({ id: players.id, name: players.name, jerseyNumber: players.jerseyNumber, preferredPositions: players.preferredPositions, email: players.email, whatsapp: players.whatsapp, availabilityToken: players.availabilityToken })
    .from(players)
    .where(eq(players.isActive, true))
    .all())
    .filter(p => !rosterIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function addPlayer(data: FormData) {
    'use server'
    const playerId = data.get('playerId') as string
    if (!playerId) return
    await db.insert(seasonRoster).values({ seasonId: params.id, playerId, createdAt: new Date() }).run()
    revalidatePath(`/seasons/${params.id}/roster`)
  }

  async function removePlayer(data: FormData) {
    'use server'
    const playerId = data.get('playerId') as string
    await db.delete(seasonRoster)
      .where(and(eq(seasonRoster.seasonId, params.id), eq(seasonRoster.playerId, playerId)))
      .run()
    revalidatePath(`/seasons/${params.id}/roster`)
  }

  async function syncRoster() {
    'use server'
    const seasonId = params.id

    const seasonGames = await db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.seasonId, seasonId), ne(games.status, 'cancelled')))
      .all()

    if (seasonGames.length === 0) { revalidatePath(`/seasons/${seasonId}/roster`); return }

    const roster = await db
      .select({ playerId: seasonRoster.playerId })
      .from(seasonRoster)
      .where(eq(seasonRoster.seasonId, seasonId))
      .all()

    if (roster.length === 0) { revalidatePath(`/seasons/${seasonId}/roster`); return }

    const gameIds = seasonGames.map(g => g.id)
    const existing = await db
      .select({ gameId: gamePlayers.gameId, playerId: gamePlayers.playerId })
      .from(gamePlayers)
      .where(inArray(gamePlayers.gameId, gameIds))
      .all()

    const existingSet = new Set(existing.map(e => `${e.gameId}:${e.playerId}`))

    for (const { id: gameId } of seasonGames) {
      for (const { playerId } of roster) {
        if (!existingSet.has(`${gameId}:${playerId}`)) {
          await db.insert(gamePlayers).values({ gameId, playerId, attendance: 'unknown' }).run()
        }
      }
    }

    revalidatePath(`/seasons/${seasonId}/roster`)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href={`/seasons/${params.id}`} style={{ color: '#6b7280', fontSize: 14 }}>← {season.name}</Link>
        <h1 style={{ margin: 0, flex: 1 }}>Season Roster</h1>
        <form action={syncRoster}>
          <button type="submit" className="btn btn-secondary btn-sm">Sync Roster to Upcoming Games</button>
        </form>
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
                  <td style={{ width: 40, color: '#9ca3af', fontWeight: 600 }}>{p.jerseyNumber ?? ''}</td>
                  <td><PlayerName name={p.name} email={p.email} mailtoSubject={season.name} mailtoBody={`${baseUrl}/availability/${p.availabilityToken}`} whatsapp={p.whatsapp} whatsappSubject={season.name} clipboardText={`${baseUrl}/availability/${p.availabilityToken}`} /></td>
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
                  <td style={{ width: 40, color: '#9ca3af', fontWeight: 600 }}>{p.jerseyNumber ?? ''}</td>
                  <td><PlayerName name={p.name} email={p.email} mailtoSubject={season.name} mailtoBody={`${baseUrl}/availability/${p.availabilityToken}`} whatsapp={p.whatsapp} whatsappSubject={season.name} clipboardText={`${baseUrl}/availability/${p.availabilityToken}`} /></td>
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
