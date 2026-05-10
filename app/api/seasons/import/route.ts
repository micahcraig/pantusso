import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/db'
import { seasons, seasonRoster, players, games, opponents, gamePlayers, lineupEntries, activityLog } from '@/db/schema'
import type { ActivityEventType } from '@/db/schema'

type ImportGame = {
  opponentName: string
  date: string
  time: string
  location: string
  homeOrAway: 'home' | 'away'
  ourScore: number | null
  opponentScore: number | null
  status: 'scheduled' | 'completed' | 'cancelled'
  attendance: Array<{ playerName: string; attendance: string; note: string | null }>
  lineup: Array<{ playerName: string; battingOrder: number | null; position: string | null; lineupStatus: string }>
}

type ImportActivityLog = {
  eventType:    string
  payload:      Record<string, unknown>
  createdAt:    string
  gameDate?:    string
  opponentName?: string
  playerName?:  string
}

type ImportBody = {
  version: number
  season: { name: string; startDate: string; endDate: string }
  players: Array<{
    name: string
    jerseyNumber: string
    preferredPositions: string[]
    phone: string | null
    email: string | null
    notes: string | null
  }>
  games: ImportGame[]
  activityLogs?: ImportActivityLog[]
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: ImportBody
  try {
    body = await req.json() as ImportBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 1. Validate
  if (![1, 2].includes(body.version) || !body.season || !body.players || !body.games) {
    return NextResponse.json({ error: 'Invalid export format' }, { status: 400 })
  }

  // 2. Upsert players — build playerName → playerId map
  const playerMap = new Map<string, string>()
  for (const p of body.players) {
    const existing = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.name, p.name))
      .get()

    if (existing) {
      playerMap.set(p.name, existing.id)
    } else {
      const newId = randomUUID()
      await db.insert(players).values({
        id:                 newId,
        name:               p.name,
        jerseyNumber:       p.jerseyNumber,
        preferredPositions: p.preferredPositions as ('P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DP' | 'FLEX' | 'BN')[],
        phone:              p.phone ?? undefined,
        email:              p.email ?? undefined,
        notes:              p.notes ?? undefined,
        availabilityToken:  randomUUID(),
        isActive:           true,
        createdAt:          new Date(),
        updatedAt:          new Date(),
      }).run()
      playerMap.set(p.name, newId)
    }
  }

  // 3. Upsert opponents — build opponentName → opponentId map
  const opponentNames = [...new Set(body.games.map(g => g.opponentName))]
  const opponentMap = new Map<string, string>()
  for (const name of opponentNames) {
    const existing = await db
      .select({ id: opponents.id })
      .from(opponents)
      .where(eq(opponents.name, name))
      .get()

    if (existing) {
      opponentMap.set(name, existing.id)
    } else {
      const newId = randomUUID()
      await db.insert(opponents).values({
        id:        newId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).run()
      opponentMap.set(name, newId)
    }
  }

  // 4. Insert new season
  const newSeasonId = randomUUID()
  await db.insert(seasons).values({
    id:        newSeasonId,
    name:      body.season.name,
    startDate: body.season.startDate,
    endDate:   body.season.endDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run()

  // 5. Insert season_roster rows for all players in body.players
  for (const p of body.players) {
    const playerId = playerMap.get(p.name)
    if (!playerId) continue
    await db.insert(seasonRoster).values({
      seasonId:  newSeasonId,
      playerId,
      createdAt: new Date(),
    }).run()
  }

  // 6. For each game: insert game, attendance, lineup
  const gameMap = new Map<string, string>() // `${date}:${opponentName}` → newGameId

  for (const game of body.games) {
    const opponentId = opponentMap.get(game.opponentName)
    if (!opponentId) continue

    const newGameId = randomUUID()
    gameMap.set(`${game.date}:${game.opponentName}`, newGameId)

    await db.insert(games).values({
      id:            newGameId,
      seasonId:      newSeasonId,
      opponentId,
      date:          game.date,
      time:          game.time,
      location:      game.location,
      homeOrAway:    game.homeOrAway,
      ourScore:      game.ourScore ?? undefined,
      opponentScore: game.opponentScore ?? undefined,
      status:        game.status,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    }).run()

    // 6b. Insert game_players
    for (const a of game.attendance) {
      const playerId = playerMap.get(a.playerName)
      if (!playerId) continue
      await db.insert(gamePlayers).values({
        id:         randomUUID(),
        gameId:     newGameId,
        playerId,
        attendance: a.attendance as 'confirmed' | 'maybe' | 'out' | 'unknown',
        note:       a.note ?? undefined,
      }).run()
    }

    // 6c. Insert lineup_entries
    for (const l of game.lineup) {
      const playerId = playerMap.get(l.playerName)
      if (!playerId) continue
      await db.insert(lineupEntries).values({
        id:           randomUUID(),
        gameId:       newGameId,
        playerId,
        battingOrder: l.battingOrder ?? undefined,
        position:     (l.position ?? undefined) as ('P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DP' | 'FLEX' | 'BN') | undefined,
        lineupStatus: l.lineupStatus as 'active' | 'bench' | 'did_not_bat',
        createdAt:    new Date(),
        updatedAt:    new Date(),
      }).run()
    }
  }

  // 7. Import activity logs (version 2 only)
  if (body.version === 2 && body.activityLogs) {
    for (const entry of body.activityLogs) {
      const gameId   = entry.gameDate && entry.opponentName
        ? gameMap.get(`${entry.gameDate}:${entry.opponentName}`)
        : undefined
      const playerId = entry.playerName ? playerMap.get(entry.playerName) : undefined

      await db.insert(activityLog).values({
        seasonId:  newSeasonId,
        gameId,
        playerId,
        eventType: entry.eventType as ActivityEventType,
        payload:   entry.payload,
        createdAt: new Date(entry.createdAt),
      }).run()
    }
  }

  // 8. Return new season id
  return NextResponse.json({ seasonId: newSeasonId }, { status: 201 })
}
