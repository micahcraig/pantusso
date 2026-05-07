import { execSync } from 'child_process'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../db/schema'

const TEST_DB_PATH = './test.db'
const TEST_DB_URL  = 'sqlite:./test.db'

// Tables in reverse dependency order so FK constraints don't block DELETE
const TABLES = [
  'lineup_entries',
  'game_players',
  'season_roster',
  'games',
  'seasons',
  'players',
  'opponents',
  'users',
]

export default async function globalSetup() {
  // Open (or create) the test database — do NOT delete the file so that
  // a reused test server's open connection stays valid (same inode).
  const sqlite = new Database(TEST_DB_PATH)

  // Disable FK enforcement at the connection level before any transaction
  // starts.  Migration 0003 contains PRAGMA foreign_keys=OFF inside its SQL,
  // but SQLite silently ignores that pragma inside a transaction.  Setting it
  // here (outside any transaction) is the only way to make DROP TABLE work
  // when child tables still have FK references to `players`.
  sqlite.pragma('foreign_keys = OFF')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: './db/migrations' })

  for (const table of TABLES) {
    sqlite.prepare(`DELETE FROM \`${table}\``).run()
  }

  sqlite.pragma('foreign_keys = ON')
  sqlite.close()

  // Seed known test data.  The migrate() call inside seed.ts is a no-op
  // because all migrations are already recorded in __drizzle_migrations.
  execSync('npx tsx db/seed.ts', {
    env: {
      ...process.env,
      DATABASE_URL:          TEST_DB_URL,
      SEED_ADMIN_EMAIL:      'admin@example.com',
      SEED_ADMIN_PASSWORD:   'changeme',
      SEED_MANAGER_EMAIL:    'manager@example.com',
      SEED_MANAGER_PASSWORD: 'changeme',
    },
    stdio: 'inherit',
  })
}
