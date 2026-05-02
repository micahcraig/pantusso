import { and, eq, gte, desc } from 'drizzle-orm'
import { db } from '@/db'
import { players, seasonRoster, seasons, games, opponents, gamePlayers } from '@/db/schema'
import type { AttendanceStatus } from '@/db/schema'

export function lookupPlayerByToken(token: string) {
  return db.select().from(players).where(eq(players.availabilityToken, token)).get() ?? null
}

export function getUpcomingGames(playerId: string) {
  // Most recent season this player is rostered on
  const roster = db
    .select({ seasonId: seasonRoster.seasonId, seasonName: seasons.name })
    .from(seasonRoster)
    .innerJoin(seasons, eq(seasonRoster.seasonId, seasons.id))
    .where(eq(seasonRoster.playerId, playerId))
    .orderBy(desc(seasons.startDate))
    .get()

  if (!roster) return { seasonName: null, games: [] }

  const today = new Date().toISOString().split('T')[0]

  const rows = db
    .select({
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
    .innerJoin(opponents,  eq(games.opponentId, opponents.id))
    .leftJoin(gamePlayers, and(eq(gamePlayers.gameId, games.id), eq(gamePlayers.playerId, playerId)))
    .where(and(eq(games.seasonId, roster.seasonId), eq(games.status, 'scheduled'), gte(games.date, today)))
    .orderBy(games.date)
    .all()

  return { seasonName: roster.seasonName, games: rows }
}

export function setAttendance(
  gameId:     string,
  playerId:   string,
  attendance: AttendanceStatus,
  note?:      string | null,
) {
  const existing = db
    .select({ id: gamePlayers.id, availabilitySetAt: gamePlayers.availabilitySetAt })
    .from(gamePlayers)
    .where(and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.playerId, playerId)))
    .get()

  const now = new Date()

  if (existing) {
    db.update(gamePlayers).set({
      attendance,
      ...(note !== undefined ? { note } : {}),
      availabilitySetAt:     existing.availabilitySetAt ?? now,
      availabilityUpdatedAt: now,
    }).where(eq(gamePlayers.id, existing.id)).run()
  } else {
    db.insert(gamePlayers).values({
      gameId, playerId, attendance,
      note:                  note ?? null,
      availabilitySetAt:     now,
      availabilityUpdatedAt: now,
    }).run()
  }
}
