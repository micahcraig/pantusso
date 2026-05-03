import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL ?? 'sqlite:./dev.db'

// Adds .get(), .all(), .run() as Promise-returning methods to MySQL query
// builders so all call sites can use `await db...get()` for both drivers.
// SQLite: .get()/.all()/.run() already exist and return synchronously;
//   await on a non-Promise just returns the value unchanged.
// MySQL: builders are PromiseLike — we add the compat methods here.
function addMysqlCompatibility(mysqlDb: unknown): BetterSQLite3Database<typeof schema> {
  const handler: ProxyHandler<object> = {
    get(target, prop) {
      const t = target as Record<string | symbol, unknown>
      const value = t[prop]
      if (typeof value !== 'function') return value
      return function (...args: unknown[]) {
        const res = (value as (...a: unknown[]) => unknown).apply(target, args)
        if (res == null || typeof res !== 'object') return res
        const obj = res as Record<string | symbol, unknown>
        if (typeof obj.then === 'function') {
          const p = res as unknown as Promise<unknown>
          if (!obj.get) obj.get = () => p.then(r => (Array.isArray(r) ? r[0] : undefined))
          if (!obj.all) obj.all = () => p
          if (!obj.run) obj.run = () => p.then(() => undefined)
        }
        return new Proxy(obj, handler)
      }
    },
  }
  return new Proxy(mysqlDb as object, handler) as unknown as BetterSQLite3Database<typeof schema>
}

function createDb(): BetterSQLite3Database<typeof schema> {
  if (DATABASE_URL.startsWith('mysql://') || DATABASE_URL.startsWith('mysql2://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/mysql2')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mysql = require('mysql2/promise')
    const pool = mysql.createPool(DATABASE_URL)
    return addMysqlCompatibility(drizzle(pool, { schema, mode: 'default' }))
  }

  const path = DATABASE_URL.replace(/^sqlite:/, '')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  return drizzle(new Database(path), { schema })
}

const globalForDb = global as unknown as { db: BetterSQLite3Database<typeof schema> }
export const db = globalForDb.db ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
