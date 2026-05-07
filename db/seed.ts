import 'dotenv/config'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import * as schema from './schema'
import type { Position } from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'sqlite:./dev.db'
const dbPath = DATABASE_URL.replace(/^sqlite:/, '')
const sqlite = new Database(dbPath)
const db = drizzle(sqlite, { schema })

// ── Helpers ───────────────────────────────────────────────────────────────────

const id = () => randomUUID()
const now = () => new Date()

// ── Migrate ───────────────────────────────────────────────────────────────────

console.log('Running migrations...')
migrate(db, { migrationsFolder: './db/migrations' })
console.log('Migrations complete.')

// ── Guard: skip if data already exists ────────────────────────────────────────

const existingUsers = db.select().from(schema.users).all()
if (existingUsers.length > 0) {
  console.log('Database already seeded — skipping.')
  process.exit(0)
}

// ── Admin user ────────────────────────────────────────────────────────────────

const adminEmail    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@example.com'
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'changeme'
const adminName     = adminEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

console.log(`Creating admin user: ${adminEmail}`)
db.insert(schema.users).values({
  id:           id(),
  name:         adminName,
  email:        adminEmail,
  passwordHash: bcrypt.hashSync(adminPassword, 10),
  role:         'admin',
  isActive:     true,
  createdAt:    now(),
  updatedAt:    now(),
}).run()

// ── Manager user ──────────────────────────────────────────────────────────────

const managerEmail    = process.env.SEED_MANAGER_EMAIL    ?? 'manager@example.com'
const managerPassword = process.env.SEED_MANAGER_PASSWORD ?? 'changeme'
const managerName     = managerEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

console.log(`Creating manager user: ${managerEmail}`)
db.insert(schema.users).values({
  id:           id(),
  name:         managerName,
  email:        managerEmail,
  passwordHash: bcrypt.hashSync(managerPassword, 10),
  role:         'manager',
  isActive:     true,
  createdAt:    now(),
  updatedAt:    now(),
}).run()

// ── Players ───────────────────────────────────────────────────────────────────

type PlayerSeed = {
  name: string
  jerseyNumber: string
  preferredPositions: Position[]
  phone?: string
  email?: string
  notes?: string
}

const playerSeeds: PlayerSeed[] = [
  { name: 'Marcus Johnson',   jerseyNumber: '7',  preferredPositions: ['P', 'SS'],  phone: '555-0101' },
  { name: 'Sarah Chen',       jerseyNumber: '12', preferredPositions: ['SS', '2B'], phone: '555-0102', email: 'sarah.chen@example.com' },
  { name: 'Derek Williams',   jerseyNumber: '23', preferredPositions: ['1B', 'RF'] },
  { name: 'Priya Patel',      jerseyNumber: '5',  preferredPositions: ['C', '3B'],  phone: '555-0104' },
  { name: 'Tommy Rodriguez',  jerseyNumber: '18', preferredPositions: ['CF', 'LF'], phone: '555-0105' },
  { name: 'Ashley Thompson',  jerseyNumber: '3',  preferredPositions: ['LF', 'CF'], phone: '555-0106', email: 'ashley.t@example.com' },
  { name: 'Jordan Kim',       jerseyNumber: '9',  preferredPositions: ['3B', 'SS'] },
  { name: 'Lisa Martinez',    jerseyNumber: '14', preferredPositions: ['RF', '1B'], phone: '555-0108' },
  { name: 'Chris Baker',      jerseyNumber: '27', preferredPositions: ['P', '1B'],  phone: '555-0109', notes: 'Can also catch in a pinch' },
  { name: 'Yuki Tanaka',      jerseyNumber: '11', preferredPositions: ['SS', '2B'], email: 'yuki@example.com' },
  { name: 'Brandon Lee',      jerseyNumber: '6',  preferredPositions: ['2B', '3B'], phone: '555-0111' },
  { name: 'Megan Foster',     jerseyNumber: '19', preferredPositions: ['C', 'RF'],  phone: '555-0112' },
]

console.log('Creating players...')
const insertedPlayers = playerSeeds.map(p => {
  const player = {
    id:                 id(),
    name:               p.name,
    jerseyNumber:       p.jerseyNumber,
    preferredPositions: p.preferredPositions,
    phone:              p.phone ?? null,
    email:              p.email ?? null,
    whatsapp:           null,
    notes:              p.notes ?? null,
    availabilityToken:  id(),
    isActive:           true,
    createdAt:          now(),
    updatedAt:          now(),
  }
  db.insert(schema.players).values(player).run()
  return player
})

const [marcus, sarah, derek, priya, tommy, ashley, jordan, lisa, chris, yuki, brandon, megan] = insertedPlayers

// ── Season ────────────────────────────────────────────────────────────────────

console.log('Creating season...')
const season = {
  id:        id(),
  name:      'Spring 2026',
  startDate: '2026-04-01',
  endDate:   '2026-06-30',
  createdAt: now(),
  updatedAt: now(),
}
db.insert(schema.seasons).values(season).run()

// ── Season roster: all 12 players ─────────────────────────────────────────────

insertedPlayers.forEach(p => {
  db.insert(schema.seasonRoster).values({
    seasonId:  season.id,
    playerId:  p.id,
    createdAt: now(),
  }).run()
})

// ── Opponents ─────────────────────────────────────────────────────────────────

console.log('Creating opponents...')
type OpponentSeed = { name: string; notes?: string }
const opponentSeeds: OpponentSeed[] = [
  { name: 'Diamond Devils' },
  { name: 'Hillside Hawks',       notes: 'Home field at Hillside Park, field #2' },
  { name: 'Riverside Renegades',  notes: 'Strong hitting team, weak outfield' },
  { name: 'County Crushers',      notes: 'Home field at County Park, field #3' },
  { name: 'Metro Mudhens' },
]

const insertedOpponents = opponentSeeds.map(o => {
  const opponent = { id: id(), name: o.name, notes: o.notes ?? null, createdAt: now(), updatedAt: now() }
  db.insert(schema.opponents).values(opponent).run()
  return opponent
})

const [diamondDevils, hillsideHawks, riversideRenegades, countyCrushers, metroMudhens] = insertedOpponents

// ── Games ─────────────────────────────────────────────────────────────────────

console.log('Creating games...')
const gameSeeds = [
  { id: id(), date: '2026-04-05', time: '18:30', location: 'Riverside Diamond, Field 1', homeOrAway: 'home' as const, opponentId: diamondDevils.id,      status: 'completed' as const, ourScore: 8,  opponentScore: 4 },
  { id: id(), date: '2026-04-12', time: '18:30', location: 'Hillside Park, Field 2',      homeOrAway: 'away' as const, opponentId: hillsideHawks.id,       status: 'completed' as const, ourScore: 3,  opponentScore: 7 },
  { id: id(), date: '2026-04-19', time: '18:30', location: 'Riverside Diamond, Field 1', homeOrAway: 'home' as const, opponentId: riversideRenegades.id,  status: 'scheduled' as const, ourScore: null, opponentScore: null },
  { id: id(), date: '2026-04-26', time: '18:00', location: 'County Park, Field 3',       homeOrAway: 'away' as const, opponentId: countyCrushers.id,      status: 'scheduled' as const, ourScore: null, opponentScore: null },
  { id: id(), date: '2026-05-03', time: '18:30', location: 'Riverside Diamond, Field 1', homeOrAway: 'home' as const, opponentId: metroMudhens.id,        status: 'scheduled' as const, ourScore: null, opponentScore: null },
  { id: id(), date: '2026-05-10', time: '18:30', location: 'Diamond Fields, Field 4',    homeOrAway: 'away' as const, opponentId: diamondDevils.id,       status: 'scheduled' as const, ourScore: null, opponentScore: null },
  { id: id(), date: '2026-05-17', time: '18:30', location: 'Riverside Diamond, Field 1', homeOrAway: 'home' as const, opponentId: hillsideHawks.id,       status: 'cancelled' as const, ourScore: null, opponentScore: null },
]

const insertedGames = gameSeeds.map(g => {
  const game = { ...g, seasonId: season.id, createdAt: now(), updatedAt: now() }
  db.insert(schema.games).values(game).run()
  return game
})

const [game1, game2, game3, game4, game5, game6 /* game7 cancelled */] = insertedGames

// ── Game Players ──────────────────────────────────────────────────────────────
// Auto-create rows for all rostered players for every non-cancelled game.
// Seed realistic attendance: completed games fully resolved, upcoming mostly unknown.

console.log('Creating game player rows...')

type AttendanceSeed = {
  game: typeof insertedGames[0]
  attendance: Record<string, 'confirmed' | 'out' | 'unknown'>
}

const attendanceSeeds: AttendanceSeed[] = [
  {
    game: game1,
    attendance: {
      [marcus.id]:  'confirmed', [sarah.id]:   'confirmed', [derek.id]:   'confirmed',
      [priya.id]:   'confirmed', [tommy.id]:   'confirmed', [ashley.id]:  'out',
      [jordan.id]:  'confirmed', [lisa.id]:    'confirmed', [chris.id]:   'confirmed',
      [yuki.id]:    'confirmed', [brandon.id]: 'out',       [megan.id]:   'confirmed',
    },
  },
  {
    game: game2,
    attendance: {
      [marcus.id]:  'confirmed', [sarah.id]:   'confirmed', [derek.id]:   'confirmed',
      [priya.id]:   'confirmed', [tommy.id]:   'confirmed', [ashley.id]:  'confirmed',
      [jordan.id]:  'out',       [lisa.id]:    'confirmed', [chris.id]:   'confirmed',
      [yuki.id]:    'confirmed', [brandon.id]: 'confirmed', [megan.id]:   'confirmed',
    },
  },
  {
    game: game3,
    attendance: {
      [marcus.id]:  'confirmed', [sarah.id]:   'confirmed', [derek.id]:   'confirmed',
      [priya.id]:   'confirmed', [tommy.id]:   'unknown',   [ashley.id]:  'confirmed',
      [jordan.id]:  'confirmed', [lisa.id]:    'out',       [chris.id]:   'confirmed',
      [yuki.id]:    'confirmed', [brandon.id]: 'confirmed', [megan.id]:   'unknown',
    },
  },
]

// Games 4-6: all unknown
;[game4, game5, game6].forEach(game => {
  attendanceSeeds.push({
    game,
    attendance: Object.fromEntries(insertedPlayers.map(p => [p.id, 'unknown'])) as Record<string, 'confirmed' | 'out' | 'unknown'>,
  })
})

const resolvedNow = now()
attendanceSeeds.forEach(({ game, attendance }) => {
  insertedPlayers.forEach(player => {
    const status = attendance[player.id] ?? 'unknown'
    const wasSet = status !== 'unknown'
    db.insert(schema.gamePlayers).values({
      id:                    id(),
      gameId:                game.id,
      playerId:              player.id,
      attendance:            status,
      availabilitySetAt:     wasSet ? resolvedNow : null,
      availabilityUpdatedAt: wasSet ? resolvedNow : null,
    }).run()
  })
})

// ── Lineup Entries ────────────────────────────────────────────────────────────
// Full lineups for the two completed games.

console.log('Creating lineup entries...')

type LineupSeed = { playerId: string; battingOrder: number | null; position: Position | null; lineupStatus: 'active' | 'bench' }

// Game 1 (W 8-4 vs Diamond Devils): 10 confirmed, 9 active + 1 bench
// Out: ashley, brandon. Active 9: marcus, sarah, derek, priya, tommy, jordan, lisa, chris, yuki. Bench: megan.
const game1Lineup: LineupSeed[] = [
  { playerId: yuki.id,   battingOrder: 1, position: 'SS',  lineupStatus: 'active' },
  { playerId: sarah.id,  battingOrder: 2, position: '2B',  lineupStatus: 'active' },
  { playerId: marcus.id, battingOrder: 3, position: 'P',   lineupStatus: 'active' },
  { playerId: derek.id,  battingOrder: 4, position: '1B',  lineupStatus: 'active' },
  { playerId: priya.id,  battingOrder: 5, position: 'C',   lineupStatus: 'active' },
  { playerId: tommy.id,  battingOrder: 6, position: 'CF',  lineupStatus: 'active' },
  { playerId: jordan.id, battingOrder: 7, position: '3B',  lineupStatus: 'active' },
  { playerId: lisa.id,   battingOrder: 8, position: 'RF',  lineupStatus: 'active' },
  { playerId: chris.id,  battingOrder: 9, position: 'LF',  lineupStatus: 'active' },
  { playerId: megan.id,  battingOrder: null, position: null, lineupStatus: 'bench' },
]

// Game 2 (L 3-7 vs Hillside Hawks): 11 confirmed, 9 active + 2 bench
// Out: jordan. Active 9: marcus, sarah, derek, priya, tommy, ashley, lisa, chris, yuki. Bench: brandon, megan.
const game2Lineup: LineupSeed[] = [
  { playerId: yuki.id,    battingOrder: 1, position: 'SS',  lineupStatus: 'active' },
  { playerId: sarah.id,   battingOrder: 2, position: '2B',  lineupStatus: 'active' },
  { playerId: marcus.id,  battingOrder: 3, position: 'P',   lineupStatus: 'active' },
  { playerId: derek.id,   battingOrder: 4, position: '1B',  lineupStatus: 'active' },
  { playerId: priya.id,   battingOrder: 5, position: 'C',   lineupStatus: 'active' },
  { playerId: tommy.id,   battingOrder: 6, position: 'CF',  lineupStatus: 'active' },
  { playerId: ashley.id,  battingOrder: 7, position: 'LF',  lineupStatus: 'active' },
  { playerId: lisa.id,    battingOrder: 8, position: 'RF',  lineupStatus: 'active' },
  { playerId: chris.id,   battingOrder: 9, position: '3B',  lineupStatus: 'active' },
  { playerId: brandon.id, battingOrder: null, position: null, lineupStatus: 'bench' },
  { playerId: megan.id,   battingOrder: null, position: null, lineupStatus: 'bench' },
]

;[
  { game: game1, lineup: game1Lineup },
  { game: game2, lineup: game2Lineup },
].forEach(({ game, lineup }) => {
  lineup.forEach(entry => {
    db.insert(schema.lineupEntries).values({
      id:           id(),
      gameId:       game.id,
      playerId:     entry.playerId,
      battingOrder: entry.battingOrder,
      position:     entry.position,
      lineupStatus: entry.lineupStatus,
      createdAt:    now(),
      updatedAt:    now(),
    }).run()
  })
})

console.log('Seed complete ✓')
console.log(`  Admin:    ${adminEmail}`)
console.log(`  Players:  ${insertedPlayers.length}`)
console.log(`  Season:   ${season.name}`)
console.log(`  Games:    ${insertedGames.length} (2 completed, 4 scheduled, 1 cancelled)`)
