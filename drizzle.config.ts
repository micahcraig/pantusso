import { defineConfig } from 'drizzle-kit'

const DATABASE_URL = process.env.DATABASE_URL ?? 'sqlite:./dev.db'
const isMysql = DATABASE_URL.startsWith('mysql')

export default defineConfig(
  isMysql
    ? {
        schema: './db/schema.ts',
        out: './db/migrations',
        dialect: 'mysql',
        dbCredentials: { url: DATABASE_URL },
      }
    : {
        schema: './db/schema.ts',
        out: './db/migrations',
        dialect: 'sqlite',
        dbCredentials: { url: DATABASE_URL.replace(/^sqlite:/, '') },
      }
)
