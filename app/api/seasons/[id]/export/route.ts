import { NextResponse } from 'next/server'
import { eq, asc, inArray } from 'drizzle-orm'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasons, seasonRoster, players, games, opponents, gamePlayers, lineupEntries } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const season = await db.select().from(seasons).where(eq(seasons.id, params.id)).get()
  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  // Load roster players
  const rosterRows = await db
    .select({
      id:                 players.id,
      name:               players.name,
      jerseyNumber:       players.jerseyNumber,
      preferredPositions: players.preferredPositions,
      phone:              players.phone,
      email:              players.email,
      notes:              players.notes,
    })
    .from(seasonRoster)
    .innerJoin(players, eq(seasonRoster.playerId, players.id))
    .where(eq(seasonRoster.seasonId, params.id))
    .all()

  // Load games with opponent names
  const gameRows = await db
    .select({
      id:            games.id,
      date:          games.date,
      time:          games.time,
      location:      games.location,
      homeOrAway:    games.homeOrAway,
      ourScore:      games.ourScore,
      opponentScore: games.opponentScore,
      status:        games.status,
      opponentName:  opponents.name,
    })
    .from(games)
    .innerJoin(opponents, eq(games.opponentId, opponents.id))
    .where(eq(games.seasonId, params.id))
    .orderBy(asc(games.date))
    .all()

  const gameIds = gameRows.map(g => g.id)

  // Load attendance and lineup only if there are games
  const attendanceRows = gameIds.length > 0
    ? await db
        .select({
          gameId:     gamePlayers.gameId,
          playerName: players.name,
          attendance: gamePlayers.attendance,
          note:       gamePlayers.note,
        })
        .from(gamePlayers)
        .innerJoin(players, eq(gamePlayers.playerId, players.id))
        .where(inArray(gamePlayers.gameId, gameIds))
        .all()
    : []

  const lineupRows = gameIds.length > 0
    ? await db
        .select({
          gameId:       lineupEntries.gameId,
          playerName:   players.name,
          battingOrder: lineupEntries.battingOrder,
          position:     lineupEntries.position,
          lineupStatus: lineupEntries.lineupStatus,
        })
        .from(lineupEntries)
        .innerJoin(players, eq(lineupEntries.playerId, players.id))
        .where(inArray(lineupEntries.gameId, gameIds))
        .orderBy(asc(lineupEntries.battingOrder))
        .all()
    : []

  // Group attendance and lineup by gameId
  const attendanceByGame = new Map<string, typeof attendanceRows>()
  for (const row of attendanceRows) {
    const existing = attendanceByGame.get(row.gameId) ?? []
    existing.push(row)
    attendanceByGame.set(row.gameId, existing)
  }

  const lineupByGame = new Map<string, typeof lineupRows>()
  for (const row of lineupRows) {
    const existing = lineupByGame.get(row.gameId) ?? []
    existing.push(row)
    lineupByGame.set(row.gameId, existing)
  }

  const exportData = {
    version: 1,
    season: {
      name:      season.name,
      startDate: season.startDate,
      endDate:   season.endDate,
    },
    players: rosterRows.map(p => ({
      name:               p.name,
      jerseyNumber:       p.jerseyNumber,
      preferredPositions: p.preferredPositions,
      phone:              p.phone,
      email:              p.email,
      notes:              p.notes,
    })),
    games: gameRows.map(g => ({
      opponentName:  g.opponentName,
      date:          g.date,
      time:          g.time,
      location:      g.location,
      homeOrAway:    g.homeOrAway,
      ourScore:      g.ourScore,
      opponentScore: g.opponentScore,
      status:        g.status,
      attendance: (attendanceByGame.get(g.id) ?? []).map(a => ({
        playerName: a.playerName,
        attendance: a.attendance,
        note:       a.note,
      })),
      lineup: (lineupByGame.get(g.id) ?? []).map(l => ({
        playerName:   l.playerName,
        battingOrder: l.battingOrder,
        position:     l.position,
        lineupStatus: l.lineupStatus,
      })),
    })),
  }

  return NextResponse.json(exportData)
}
