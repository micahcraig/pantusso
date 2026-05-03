#!/usr/bin/env node
'use strict'

const path = require('path')
const migrationsFolder = path.join(__dirname, '..', 'db', 'migrations')
const url = (process.env.DATABASE_URL || '').trim()

if (url.startsWith('mysql://') || url.startsWith('mysql2://')) {
  const run = async () => {
    const { createConnection } = require('mysql2/promise')
    const { drizzle } = require('drizzle-orm/mysql2')
    const { migrate } = require('drizzle-orm/mysql2/migrator')

    // Extract database name and build a URL without it so we can CREATE DATABASE
    const parsed   = new URL(url)
    const dbName   = parsed.pathname.replace(/^\//, '')
    parsed.pathname = '/'
    const rootUrl  = parsed.toString()

    const root = await createConnection(rootUrl)
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
    await root.end()

    const conn = await createConnection(url)
    await migrate(drizzle(conn), { migrationsFolder })
    await conn.end()
  }
  run()
    .then(() => { console.log('Migrations applied'); process.exit(0) })
    .catch(e => { console.error('Migration failed:', e); process.exit(1) })
} else {
  const dbPath = url.replace(/^sqlite:/, '') || './dev.db'
  const Database = require('better-sqlite3')
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const { migrate } = require('drizzle-orm/better-sqlite3/migrator')
  try {
    migrate(drizzle(new Database(dbPath)), { migrationsFolder })
    console.log('Migrations applied')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  }
}
