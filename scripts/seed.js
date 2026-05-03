#!/usr/bin/env node
'use strict'

const { randomUUID } = require('crypto')
const bcrypt         = require('bcryptjs')

const url           = (process.env.DATABASE_URL       || '').trim()
const adminEmail    =  process.env.SEED_ADMIN_EMAIL    || 'admin@example.com'
const adminPassword =  process.env.SEED_ADMIN_PASSWORD || 'changeme'
const adminName     = adminEmail.split('@')[0]
  .replace(/[._-]/g, ' ')
  .replace(/\b\w/g, c => c.toUpperCase())

if (url.startsWith('mysql://') || url.startsWith('mysql2://')) {
  const run = async () => {
    const { createConnection } = require('mysql2/promise')
    const conn = await createConnection(url)
    const [rows] = await conn.query('SELECT id FROM users LIMIT 1')
    if (rows.length > 0) {
      console.log('Database already seeded — skipping.')
      await conn.end()
      return
    }
    const passwordHash = bcrypt.hashSync(adminPassword, 10)
    const now = Math.floor(Date.now() / 1000)
    await conn.query(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), adminName, adminEmail, passwordHash, 'admin', 1, now, now]
    )
    await conn.end()
    console.log(`Admin user created: ${adminEmail}`)
  }
  run()
    .then(() => { console.log('Seed complete'); process.exit(0) })
    .catch(e => { console.error('Seed failed:', e); process.exit(1) })
} else {
  const dbPath = url.replace(/^sqlite:/, '') || './dev.db'
  const Database = require('better-sqlite3')
  const db = new Database(dbPath)
  const existing = db.prepare('SELECT id FROM users LIMIT 1').get()
  if (existing) {
    console.log('Database already seeded — skipping.')
    process.exit(0)
  }
  const passwordHash = bcrypt.hashSync(adminPassword, 10)
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), adminName, adminEmail, passwordHash, 'admin', 1, now, now)
  db.close()
  console.log(`Admin user created: ${adminEmail}`)
  console.log('Seed complete')
}
