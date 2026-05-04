#!/usr/bin/env node
// One-time backfill: inserts missing game_players rows for players who were
// added to a season roster after games already existed.
//
// Safe to run multiple times — only inserts rows that are absent.
//
// Usage:
//   DATABASE_URL=sqlite:./dev.db  node scripts/backfill-game-players.js
//   DATABASE_URL=mysql://root:devpassword@127.0.0.1:3306/pantusso  node scripts/backfill-game-players.js
'use strict'

const { randomUUID } = require('crypto')
const url = (process.env.DATABASE_URL || '').trim()

// Finds every (game_id, player_id) pair that belongs in game_players but is absent.
const MISSING_SQL = `
  SELECT g.id AS game_id, sr.player_id
  FROM season_roster sr
  JOIN games g ON g.season_id = sr.season_id
  LEFT JOIN game_players gp ON gp.game_id = g.id AND gp.player_id = sr.player_id
  WHERE g.status != 'cancelled'
    AND gp.id IS NULL
`

if (url.startsWith('mysql://') || url.startsWith('mysql2://')) {
  const run = async () => {
    const { createConnection } = require('mysql2/promise')
    const conn = await createConnection(url)

    const [rows] = await conn.query(MISSING_SQL)
    console.log(`Found ${rows.length} missing game_players row(s).`)

    for (const { game_id, player_id } of rows) {
      await conn.query(
        'INSERT INTO game_players (id, game_id, player_id, attendance) VALUES (?, ?, ?, ?)',
        [randomUUID(), game_id, player_id, 'unknown']
      )
    }

    await conn.end()
    console.log('Backfill complete.')
  }
  run()
    .then(() => process.exit(0))
    .catch(e => { console.error('Backfill failed:', e); process.exit(1) })
} else {
  const dbPath = url.replace(/^sqlite:/, '') || './dev.db'
  const Database = require('better-sqlite3')
  const db = new Database(dbPath)

  const rows = db.prepare(MISSING_SQL).all()
  console.log(`Found ${rows.length} missing game_players row(s).`)

  const insert = db.prepare(
    'INSERT INTO game_players (id, game_id, player_id, attendance) VALUES (?, ?, ?, ?)'
  )
  const backfill = db.transaction(() => {
    for (const { game_id, player_id } of rows) {
      insert.run(randomUUID(), game_id, player_id, 'unknown')
    }
  })
  backfill()

  db.close()
  console.log('Backfill complete.')
}
