#!/usr/bin/env node
// One-off script to apply migration 0003 outside Drizzle's transaction wrapper.
// PRAGMA foreign_keys=OFF is a no-op inside a transaction (SQLite limitation),
// so this script runs each statement directly on the connection.
const Database = require('better-sqlite3')
const crypto   = require('crypto')
const fs       = require('fs')
const path     = require('path')

const DB_PATH   = path.join(__dirname, '..', 'dev.db')
const SQL_PATH  = path.join(__dirname, '..', 'db', 'migrations', '0003_misty_red_hulk.sql')

const db = new Database(DB_PATH)

// Check if already applied
const existing = db.prepare('SELECT hash FROM __drizzle_migrations WHERE hash = ?').get(
  crypto.createHash('sha256').update(fs.readFileSync(SQL_PATH, 'utf8')).digest('hex')
)
if (existing) {
  console.log('Migration 0003 already applied.')
  db.close()
  process.exit(0)
}

const content = fs.readFileSync(SQL_PATH, 'utf8')
const hash    = crypto.createHash('sha256').update(content).digest('hex')

const statements = content
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(Boolean)

console.log(`Applying ${statements.length} statements...`)

for (const sql of statements) {
  console.log('  >', sql.slice(0, 60).replace(/\n/g, ' '))
  db.prepare(sql).run()
}

db.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(hash, Date.now())
console.log('Done. Migration 0003 applied and recorded.')
db.close()
