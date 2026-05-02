import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'sqlite:./dev.db'

// Returns BetterSQLite3Database in dev (SQLite) or MySql2Database in prod.
// Both implement the same Drizzle query API; typed as SQLite here since that
// covers the dev/test path. The MySQL path is runtime-correct.
function createDb(): BetterSQLite3Database<typeof schema> {
  if (DATABASE_URL.startsWith('mysql://') || DATABASE_URL.startsWith('mysql2://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/mysql2')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mysql = require('mysql2/promise')
    const pool = mysql.createPool(DATABASE_URL)
    return drizzle(pool, { schema, mode: 'default' })
  }

  const path = DATABASE_URL.replace(/^sqlite:/, '')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  return drizzle(new Database(path), { schema })
}

// Singleton — survives Next.js hot reloads in dev
const globalForDb = global as unknown as { db: BetterSQLite3Database<typeof schema> }
export const db = globalForDb.db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
