import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { players, seasonRoster, seasons, games, opponents, gamePlayers } from '@/db/schema'
import type { AttendanceStatus } from '@/db/schema'
import { logActivity } from '@/lib/activity'

export type AttendanceCounts = { confirmed: number; maybe: number; out: number }

export async function getGameAttendanceCounts(gameIds: string[]): Promise<Record<string, AttendanceCounts>> {
  if (gameIds.length === 0) return {}
  const rows = await db
    .select({ gameId: gamePlayers.gameId, attendance: gamePlayers.attendance })
    .from(gamePlayers)
    .where(inArray(gamePlayers.gameId, gameIds))
    .all()
  const counts: Record<string, AttendanceCounts> = {}
  for (const { gameId, attendance } of rows) {
    if (!counts[gameId]) counts[gameId] = { confirmed: 0, maybe: 0, out: 0 }
    if (attendance === 'confirmed') counts[gameId].confirmed++
    else if (attendance === 'maybe')     counts[gameId].maybe++
    else if (attendance === 'out')       counts[gameId].out++
  }
  return counts
}

export async function lookupPlayerByToken(token: string) {
  return (await db.select().from(players).where(eq(players.availabilityToken, token)).get()) ?? null
}

export type SeasonWithGames = {
  seasonName: string
  games: Array<{
    gameId:       string
    date:         string
    time:         string
    location:     string
    homeOrAway:   'home' | 'away'
    opponentName: string
    attendance:   AttendanceStatus | null
    note:         string | null
  }>
}

export async function getUpcomingGames(playerId: string): Promise<{ seasons: SeasonWithGames[] }> {
  const rosteredSeasonIds = (await db
    .select({ seasonId: seasonRoster.seasonId })
    .from(seasonRoster)
    .where(eq(seasonRoster.playerId, playerId))
    .all())
    .map(r => r.seasonId)

  if (rosteredSeasonIds.length === 0) return { seasons: [] }

  const today = new Date().toISOString().split('T')[0]

  const rows = await db
    .select({
      seasonId:     games.seasonId,
      seasonName:   seasons.name,
      seasonStart:  seasons.startDate,
      gameId:       games.id,
      date:         games.date,
      time:         games.time,
      location:     games.location,
      homeOrAway:   games.homeOrAway,
      opponentName: opponents.name,
      attendance:   gamePlayers.attendance,
      note:         gamePlayers.note,
    })
    .from(games)
    .innerJoin(seasons,    eq(games.seasonId,   seasons.id))
    .innerJoin(opponents,  eq(games.opponentId, opponents.id))
    .leftJoin(gamePlayers, and(eq(gamePlayers.gameId, games.id), eq(gamePlayers.playerId, playerId)))
    .where(and(
      inArray(games.seasonId, rosteredSeasonIds),
      eq(games.status, 'scheduled'),
      gte(games.date, today),
    ))
    .orderBy(seasons.startDate, games.date)
    .all()

  const seasonMap = new Map<string, SeasonWithGames & { seasonStart: string }>()
  for (const row of rows) {
    if (!seasonMap.has(row.seasonId)) {
      seasonMap.set(row.seasonId, { seasonName: row.seasonName, seasonStart: row.seasonStart, games: [] })
    }
    seasonMap.get(row.seasonId)!.games.push({
      gameId:       row.gameId,
      date:         row.date,
      time:         row.time,
      location:     row.location,
      homeOrAway:   row.homeOrAway,
      opponentName: row.opponentName,
      attendance:   row.attendance,
      note:         row.note,
    })
  }

  return { seasons: [...seasonMap.values()].map(({ seasonName, games }) => ({ seasonName, games })) }
}

export async function setAttendance(
  gameId:     string,
  playerId:   string,
  attendance: AttendanceStatus,
  note?:      string | null,
) {
  const existing = await db
    .select({ id: gamePlayers.id, availabilitySetAt: gamePlayers.availabilitySetAt, attendance: gamePlayers.attendance })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, playerId)))
    .get()

  const now = new Date()

  if (existing) {
    await db.update(gamePlayers).set({
      attendance,
      ...(note !== undefined ? { note } : {}),
      availabilitySetAt:     existing.availabilitySetAt ?? now,
      availabilityUpdatedAt: now,
    }).where(eq(gamePlayers.id, existing.id)).run()
  } else {
    await db.insert(gamePlayers).values({
      gameId, playerId, attendance,
      note:                  note ?? null,
      availabilitySetAt:     now,
      availabilityUpdatedAt: now,
    }).run()
  }

  const [gameInfo, playerInfo] = await Promise.all([
    db.select({ seasonId: games.seasonId, date: games.date, opponentName: opponents.name })
      .from(games)
      .innerJoin(opponents, eq(games.opponentId, opponents.id))
      .where(eq(games.id, gameId))
      .get(),
    db.select({ name: players.name })
      .from(players)
      .where(eq(players.id, playerId))
      .get(),
  ])

  if (gameInfo && playerInfo) {
    await logActivity({
      seasonId:  gameInfo.seasonId,
      gameId,
      playerId,
      eventType: 'availability_updated',
      payload: {
        playerName:   playerInfo.name,
        gameDate:     gameInfo.date,
        opponentName: gameInfo.opponentName,
        status:       attendance,
        prevStatus:   existing?.attendance ?? null,
        note:         note ?? null,
      },
    })
  }
}
