import pg from 'pg'
import { existsSync, readFileSync } from 'node:fs'

const envFile = new URL('../.env', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

const { Pool } = pg

// On Render (and other cloud hosts), DATABASE_URL is provided as a full
// connection string. Fall back to individual host/port/user/password/database
// params for local development.
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'cresa_app',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'cresa_library',
      max: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    })

// Read the full schema. Postgres can execute multiple statements in one query
// call, so we pass the whole file at once — no need to split on semicolons,
// which would break the DO $$ ... $$ blocks used for idempotent enum creation.
const schemaText = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8')

export async function initializeDatabase() {
  // Render provisions the database for us; no bootstrap CREATE DATABASE needed.
  // Just run the schema (all CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
  // / DO $$ ... $$ blocks are idempotent).
  await pool.query(schemaText)

  // `CREATE TABLE IF NOT EXISTS` does not add new columns to existing installs.
  // Keep this small, idempotent upgrade here so subject/course/tags work for
  // databases created before those columns were added.
  const { rows: columns } = await pool.query(
    "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resources'",
  )
  const present = new Set(columns.map(column => column.name))
  const additions = [
    ['subject', 'VARCHAR(150) NULL'],
    ['course',  'VARCHAR(150) NULL'],
    ['tags',    'JSONB NULL'],
  ]
  for (const [name, definition] of additions) {
    if (!present.has(name)) await pool.query(`ALTER TABLE resources ADD COLUMN ${name} ${definition}`)
  }
}

export async function requireDatabase() {
  await initializeDatabase()
  await pool.query('SELECT 1')
}
