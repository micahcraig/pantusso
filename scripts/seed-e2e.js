#!/usr/bin/env node
'use strict'

// Full demo seed for MySQL E2E tests only.
// Seeds admin user + 12 players + Spring 2026 season + 5 opponents + 7 games
// + season roster + game_players + lineup entries for game 1.
// Always truncates all tables first so partial prior runs don't leave stale data.

const { randomUUID } = require('crypto')
const bcrypt         = require('bcryptjs')

const url            = (process.env.DATABASE_URL       || '').trim()
const adminEmail     =  process.env.SEED_ADMIN_EMAIL    || 'admin@example.com'
const adminPassword  =  process.env.SEED_ADMIN_PASSWORD || 'changeme'
const adminName      = adminEmail.split('@')[0]
  .replace(/[._-]/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase())

if (!url.startsWith('mysql://') && !url.startsWith('mysql2://')) {
  console.error('seed-e2e.js requires a MySQL DATABASE_URL')
  process.exit(1)
}

const run = async () => {
  const { createConnection } = require('mysql2/promise')
  const conn = await createConnection(url)

  // Always start from a clean slate so partial previous runs don't leave stale data.
  await conn.query('SET FOREIGN_KEY_CHECKS=0')
  for (const t of ['lineup_entries', 'game_players', 'season_roster', 'games', 'opponents', 'seasons', 'players', 'users']) {
    await conn.query(`TRUNCATE TABLE \`${t}\``)
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1')

  const now = Math.floor(Date.now() / 1000)
  const passwordHash = bcrypt.hashSync(adminPassword, 10)

  // ── Admin user ──────────────────────────────────────────────────────────────
  const [[existingAdmin]] = await conn.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail]
  )
  if (!existingAdmin) {
    await conn.query(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), adminName, adminEmail, passwordHash, 'admin', 1, now, now]
    )
  }

  // ── Players ─────────────────────────────────────────────────────────────────
  const playerRows = [
    { name: 'Marcus Johnson',  jersey: '7',  positions: ['P',  'SS'] },
    { name: 'Sarah Chen',      jersey: '12', positions: ['1B', 'CF'] },
    { name: 'Derek Williams',  jersey: '3',  positions: ['C',  '1B'] },
    { name: 'Aisha Patel',     jersey: '21', positions: ['2B', '3B'] },
    { name: 'Tom Nguyen',      jersey: '9',  positions: ['SS', '2B'] },
    { name: 'Rosa Martinez',   jersey: '16', positions: ['LF', 'CF'] },
    { name: 'Kevin O\'Brien',  jersey: '5',  positions: ['3B', 'SS'] },
    { name: 'Lena Kowalski',   jersey: '18', positions: ['RF', 'LF'] },
    { name: 'James Thompson',  jersey: '2',  positions: ['C',  'DP'] },
    { name: 'Maya Robinson',   jersey: '14', positions: ['CF', 'RF'] },
    { name: 'Chris Santos',    jersey: '8',  positions: ['1B', 'DP'] },
    { name: 'Priya Sharma',    jersey: '22', positions: ['2B', 'P']  },
  ]

  const playerIds = []
  for (const p of playerRows) {
    const id = randomUUID()
    playerIds.push(id)
    await conn.query(
      'INSERT INTO players (id, name, jersey_number, preferred_positions, availability_token, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, p.name, p.jersey, JSON.stringify(p.positions), randomUUID(), 1, now, now]
    )
  }

  // ── Season ──────────────────────────────────────────────────────────────────
  const seasonId = randomUUID()
  await conn.query(
    'INSERT INTO seasons (id, name, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [seasonId, 'Spring 2026', '2026-04-01', '2026-07-31', now, now]
  )

  // ── Season roster ────────────────────────────────────────────────────────────
  for (const pid of playerIds) {
    await conn.query(
      'INSERT INTO season_roster (season_id, player_id, created_at) VALUES (?, ?, ?)',
      [seasonId, pid, now]
    )
  }

  // ── Opponents ────────────────────────────────────────────────────────────────
  const opponentDefs = [
    { name: 'Diamond Devils',      notes: null },
    { name: 'Hillside Hawks',      notes: 'Hillside Park, Field 3. Bring extra balls.' },
    { name: 'Riverside Renegades', notes: null },
    { name: 'County Crushers',     notes: null },
    { name: 'Metro Mudhens',       notes: null },
  ]
  const opponentIds = []
  for (const o of opponentDefs) {
    const id = randomUUID()
    opponentIds.push(id)
    await conn.query(
      'INSERT INTO opponents (id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, o.name, o.notes, now, now]
    )
  }
  const [diamondDevils, hillsideHawks, riversideRenegades, countyCrushers, metroMudhens] = opponentIds

  // ── Games ─────────────────────────────────────────────────────────────────────
  const gameDefs = [
    // completed W: 8-4 vs Diamond Devils
    { opponentId: diamondDevils,     date: '2026-04-15', time: '18:30', location: 'Riverside Park Field 1', homeOrAway: 'home', ourScore: 8,    opponentScore: 4,    status: 'completed' },
    // completed L: 3-7 vs Hillside Hawks
    { opponentId: hillsideHawks,     date: '2026-04-22', time: '19:00', location: 'Hillside Athletic Complex', homeOrAway: 'away', ourScore: 3, opponentScore: 7,    status: 'completed' },
    // scheduled
    { opponentId: riversideRenegades, date: '2026-05-06', time: '18:30', location: 'Riverside Park Field 1', homeOrAway: 'home', ourScore: null, opponentScore: null, status: 'scheduled' },
    { opponentId: countyCrushers,    date: '2026-05-13', time: '19:00', location: 'County Sports Complex', homeOrAway: 'away', ourScore: null, opponentScore: null, status: 'scheduled' },
    { opponentId: metroMudhens,      date: '2026-05-20', time: '18:30', location: 'Riverside Park Field 2', homeOrAway: 'home', ourScore: null, opponentScore: null, status: 'scheduled' },
    { opponentId: diamondDevils,     date: '2026-05-27', time: '19:00', location: 'Diamond Field', homeOrAway: 'away', ourScore: null, opponentScore: null, status: 'scheduled' },
    // cancelled
    { opponentId: hillsideHawks,     date: '2026-06-03', time: '18:30', location: 'Hillside Athletic Complex', homeOrAway: 'away', ourScore: null, opponentScore: null, status: 'cancelled' },
  ]

  const gameIds = []
  for (const g of gameDefs) {
    const id = randomUUID()
    gameIds.push(id)
    await conn.query(
      'INSERT INTO games (id, season_id, opponent_id, date, time, location, home_or_away, our_score, opponent_score, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, seasonId, g.opponentId, g.date, g.time, g.location, g.homeOrAway, g.ourScore, g.opponentScore, g.status, now, now]
    )
  }

  // ── Game players ──────────────────────────────────────────────────────────────
  // Game 1 (Diamond Devils, completed): all players seeded with attendance
  const game1Attendance = [
    'confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed',
    'confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed',
    'out', 'out',
  ]
  for (let i = 0; i < playerIds.length; i++) {
    await conn.query(
      'INSERT INTO game_players (id, game_id, player_id, attendance) VALUES (?, ?, ?, ?)',
      [randomUUID(), gameIds[0], playerIds[i], game1Attendance[i] ?? 'unknown']
    )
  }
  // Game 2 (Hillside Hawks, completed): all players seeded
  const game2Attendance = [
    'confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed',
    'confirmed', 'confirmed', 'confirmed', 'confirmed', 'out',
    'out', 'unknown',
  ]
  for (let i = 0; i < playerIds.length; i++) {
    await conn.query(
      'INSERT INTO game_players (id, game_id, player_id, attendance) VALUES (?, ?, ?, ?)',
      [randomUUID(), gameIds[1], playerIds[i], game2Attendance[i] ?? 'unknown']
    )
  }
  // Remaining games: all unknown
  for (let g = 2; g < gameIds.length; g++) {
    for (const pid of playerIds) {
      await conn.query(
        'INSERT INTO game_players (id, game_id, player_id, attendance) VALUES (?, ?, ?, ?)',
        [randomUUID(), gameIds[g], pid, 'unknown']
      )
    }
  }

  // ── Lineup entries for game 1 ─────────────────────────────────────────────────
  // 10 active (confirmed players), 2 bench
  const game1Lineup = [
    { playerIdx: 0,  battingOrder: 1,  position: 'P',    lineupStatus: 'active' },
    { playerIdx: 1,  battingOrder: 2,  position: '1B',   lineupStatus: 'active' },
    { playerIdx: 2,  battingOrder: 3,  position: 'C',    lineupStatus: 'active' },
    { playerIdx: 3,  battingOrder: 4,  position: '2B',   lineupStatus: 'active' },
    { playerIdx: 4,  battingOrder: 5,  position: 'SS',   lineupStatus: 'active' },
    { playerIdx: 5,  battingOrder: 6,  position: 'LF',   lineupStatus: 'active' },
    { playerIdx: 6,  battingOrder: 7,  position: '3B',   lineupStatus: 'active' },
    { playerIdx: 7,  battingOrder: 8,  position: 'RF',   lineupStatus: 'active' },
    { playerIdx: 8,  battingOrder: 9,  position: 'DP',   lineupStatus: 'active' },
    { playerIdx: 9,  battingOrder: 10, position: 'CF',   lineupStatus: 'active' },
    { playerIdx: 10, battingOrder: null, position: null,  lineupStatus: 'bench'  },
    { playerIdx: 11, battingOrder: null, position: null,  lineupStatus: 'bench'  },
  ]
  for (const entry of game1Lineup) {
    await conn.query(
      'INSERT INTO lineup_entries (id, game_id, player_id, batting_order, position, lineup_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), gameIds[0], playerIds[entry.playerIdx], entry.battingOrder, entry.position, entry.lineupStatus, now, now]
    )
  }

  await conn.end()
  console.log('E2E seed complete: admin + 12 players + Spring 2026 season + 5 opponents + 7 games')
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error('E2E seed failed:', e); process.exit(1) })
