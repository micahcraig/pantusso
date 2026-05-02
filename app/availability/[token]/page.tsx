import { notFound } from 'next/navigation'
import { lookupPlayerByToken, getUpcomingGames } from '@/lib/availability'
import AvailabilityForm from './AvailabilityForm'
import type { GameRow } from './AvailabilityForm'

export default function AvailabilityPage({ params }: { params: { token: string } }) {
  const player = lookupPlayerByToken(params.token)
  if (!player) notFound()

  const { seasonName, games } = getUpcomingGames(player.id)

  const gameRows: GameRow[] = games.map(g => ({
    gameId:       g.gameId,
    date:         g.date,
    time:         g.time,
    location:     g.location,
    homeOrAway:   g.homeOrAway,
    opponentName: g.opponentName,
    attendance:   g.attendance ?? 'unknown',
    note:         g.note ?? null,
  }))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <AvailabilityForm
        token={params.token}
        playerName={player.name}
        seasonName={seasonName}
        initialGames={gameRows}
      />
    </div>
  )
}
