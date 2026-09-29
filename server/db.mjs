import mysql from 'mysql2/promise'
import { existsSync, readFileSync } from 'node:fs'

const envFile = new URL('../.env', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
}

const databaseName = process.env.DB_NAME ?? 'cresa_library'
const connectionOptions = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'cresa_app',
  password: process.env.DB_PASSWORD ?? '',
}

export const pool = mysql.createPool({
  ...connectionOptions,
  database: databaseName,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
  queueLimit: 0,
})

const schemaStatements = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8')
  .replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;\s*/i, '')
  .replace(/USE\s+`?\w+`?\s*;\s*/i, '')
  .split(/;\s*(?:\r?\n|$)/)
  .map(statement => statement.trim())
  .filter(Boolean)

export async function initializeDatabase() {
  const bootstrapConnection = await mysql.createConnection({
    ...connectionOptions,
    user: process.env.DB_BOOTSTRAP_USER || connectionOptions.user,
    password: process.env.DB_BOOTSTRAP_PASSWORD ?? connectionOptions.password,
  })

  try {
    await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName.replaceAll('`', '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  } finally {
    await bootstrapConnection.end()
  }

  for (const statement of schemaStatements) await pool.query(statement)

  // `CREATE TABLE IF NOT EXISTS` does not add new columns to existing installs.
  // Keep this small, idempotent upgrade here so administrator metadata works for
  // both new libraries and databases created before this feature.
  const [columns] = await pool.execute(
    'SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
    [databaseName, 'resources'],
  )
  const present = new Set(columns.map(column => column.name))
  const additions = [
    ['subject', 'VARCHAR(150) NULL AFTER category'],
    ['course', 'VARCHAR(150) NULL AFTER subject'],
    ['tags', 'JSON NULL AFTER course'],
  ]
  for (const [name, definition] of additions) {
    if (!present.has(name)) await pool.query(`ALTER TABLE resources ADD COLUMN ${name} ${definition}`)
  }

  // Ensure expires_at columns are DATETIME to prevent MySQL/MariaDB from
  // automatically assigning `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
  // to TIMESTAMP columns when explicit defaults are disabled.
  try {
    await pool.query('ALTER TABLE user_sessions MODIFY COLUMN expires_at DATETIME NOT NULL')
    await pool.query('ALTER TABLE verification_tokens MODIFY COLUMN expires_at DATETIME NOT NULL')
    await pool.query('ALTER TABLE password_reset_tokens MODIFY COLUMN expires_at DATETIME NOT NULL')
  } catch {
    // Already DATETIME or table not yet populated
  }
}

export async function requireDatabase() {
  await initializeDatabase()
  await pool.query('SELECT 1')
}
