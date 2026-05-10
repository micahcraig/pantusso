import { notFound } from 'next/navigation'
import { lookupPlayerByToken, getUpcomingGames, getGameAttendanceCounts } from '@/lib/availability'
import AvailabilityForm from './AvailabilityForm'
import type { GameRow } from './AvailabilityForm'

export default async function AvailabilityPage({ params }: { params: { token: string } }) {
  const player = await lookupPlayerByToken(params.token)
  if (!player) notFound()

  const { seasons: rawSeasons } = await getUpcomingGames(player.id)
  const allGameIds = rawSeasons.flatMap(s => s.games.map(g => g.gameId))
  const counts     = await getGameAttendanceCounts(allGameIds)

  const seasons = rawSeasons.map(s => ({
    seasonName: s.seasonName,
    games: s.games.map(g => ({
      gameId:       g.gameId,
      date:         g.date,
      time:         g.time,
      location:     g.location,
      homeOrAway:   g.homeOrAway,
      opponentName: g.opponentName,
      attendance:   g.attendance ?? 'unknown',
      note:         g.note ?? null,
      counts:       counts[g.gameId] ?? { confirmed: 0, maybe: 0, out: 0 },
    })),
  }))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AvailabilityForm
        token={params.token}
        playerName={player.name}
        seasons={seasons}
      />
    </div>
  )
}
