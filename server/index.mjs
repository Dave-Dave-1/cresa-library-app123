import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { closeSync, createReadStream, existsSync, mkdirSync, openSync, readSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, requireDatabase } from './db.mjs'
import { createSessionToken, createVerificationCode, hashPassword, hashValue, matchesPassword } from './security.mjs'

const DEFAULT_PORT = Number(process.env.PORT ?? 3001)
const CODE_TTL_MINUTES = 10
const SESSION_TTL_DAYS = 7
const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'
const serverDirectory = dirname(fileURLToPath(import.meta.url))

const getAvailablePort = async (startPort = DEFAULT_PORT) => {
  const { createServer } = await import('node:net')

  return new Promise((resolve, reject) => {
    const tester = createServer()

    tester.once('error', error => {
      if (error && error.code === 'EADDRINUSE') {
        resolve(getAvailablePort(startPort + 1))
        return
      }
      reject(error)
    })

    tester.once('listening', () => {
      const port = tester.address()?.port ?? startPort
      tester.close(() => resolve(port))
    })

    tester.listen(startPort, '0.0.0.0')
  })
}
// Allow the storage location to be overridden with BOOKS_DIR (absolute path) for deployments
// where the "public/books" folder isn't a sibling of the server folder. Defaults to the
// original convention: <project-root>/public/books, where <project-root> is one level above /server.
const booksDirectory = resolve(process.env.BOOKS_DIR ?? join(serverDirectory, '..', 'public', 'books'))
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
// The model remains configurable through GEMINI_MODEL for provider-side availability.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite'
const notificationClients = new Map()

// Fail loudly at boot if the book storage folder is missing or empty, instead of only
// discovering it later as a mysterious "no data" error in the reader UI.
function reportBooksDirectoryStatus() {
  if (!existsSync(booksDirectory)) {
    console.error(`[books] MISSING: the book storage folder does not exist at: ${booksDirectory}`)
    console.error('[books] Fix by creating this folder and placing the PDF/DOCX files in it, or set the BOOKS_DIR environment variable to the correct absolute path.')
    return
  }
  const stats = statSync(booksDirectory)
  if (!stats.isDirectory()) {
    console.error(`[books] MISCONFIGURED: expected a folder but found a file at: ${booksDirectory}`)
    return
  }
  const files = readdirSync(booksDirectory)
  const emptyFiles = files.filter(name => { try { return statSync(join(booksDirectory, name)).size === 0 } catch { return false } })
  console.log(`[books] Serving book files from: ${booksDirectory} (${files.length} file(s) found)`)
  if (emptyFiles.length) console.warn(`[books] WARNING: ${emptyFiles.length} file(s) in that folder are 0 bytes and will fail to open: ${emptyFiles.join(', ')}`)
}

const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range, Accept',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE, OPTIONS',
  })
  response.end(JSON.stringify(body))
}

const bookMimeType = filename => ({ '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[extname(filename).toLowerCase()] ?? 'application/octet-stream')

// Lists what's actually on disk so a mismatch between resources.ts and the real files
// (missing file, wrong case, empty upload) can be spotted immediately without shell access.
// Visit GET /api/books-status in a browser or curl it.
function reportBooksStatus(request, response) {
  if (!existsSync(booksDirectory)) return json(response, 200, { ok: true, booksDirectory, directoryExists: false, files: [] })
  const files = readdirSync(booksDirectory).map(name => {
    const stats = statSync(join(booksDirectory, name))
    return { name, sizeBytes: stats.size, empty: stats.size === 0 }
  })
  return json(response, 200, { ok: true, booksDirectory, directoryExists: true, files })
}

const streamBook = (request, response, requestedName, { readerStream = false } = {}) => {
  const filename = basename(decodeURIComponent(requestedName))
  const filePath = resolve(booksDirectory, filename)
  // Real traversal guard: the resolved path must actually stay inside booksDirectory.
  if (!filename || (filePath !== booksDirectory && !filePath.startsWith(booksDirectory + sep))) {
    return json(response, 400, { ok: false, error: 'Invalid book filename.' })
  }
  if (!existsSync(booksDirectory)) {
    console.error(`[books] Request for "${filename}" failed: storage folder missing at ${booksDirectory}`)
    return json(response, 500, { ok: false, error: 'Book storage is not configured on the server.' })
  }
  if (!existsSync(filePath)) {
    console.warn(`[books] Request for "${filename}" failed: file not found at ${filePath}`)
    return json(response, 404, { ok: false, error: 'Book file not found.' })
  }
  const file = statSync(filePath)
  if (!file.isFile()) {
    console.error(`[books] Request for "${filename}" failed: path is not a file: ${filePath}`)
    return json(response, 404, { ok: false, error: 'Book file not found.' })
  }
  if (file.size === 0) {
    console.error(`[books] Request for "${filename}" failed: file exists but is 0 bytes at ${filePath}`)
    return json(response, 500, { ok: false, error: 'This book file is empty on the server. Please re-upload it.' })
  }
  // Library files are intentionally readable by the browser PDF/DOCX viewer. Use a
  // public CORS response here so local development works from localhost or 127.0.0.1.
  // Account APIs above keep their stricter configured origin policy.
  // The reader stream deliberately uses an opaque URL and binary MIME type. Some
  // download-manager browser extensions intercept URLs/mime types that look like
  // PDFs and replace fetch responses with an empty 204 response. The React reader
  // converts these bytes back into an in-memory application/pdf Blob itself.
  const baseHeaders = {
    'Content-Type': readerStream ? 'application/octet-stream' : bookMimeType(filename),
    'Content-Disposition': readerStream ? 'inline' : `inline; filename="${filename}"`,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range',
    'Accept-Ranges': 'bytes',
  }
  const range = request.headers.range?.match(/bytes=(\d*)-(\d*)/)
  let start = 0
  let end = file.size - 1
  if (range) {
    start = range[1] ? Number(range[1]) : 0
    end = range[2] ? Number(range[2]) : end
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= file.size || end < start) {
      response.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${file.size}` })
      return response.end()
    }
    end = Math.min(end, file.size - 1)
    const contentLength = end - start + 1
    response.writeHead(206, { ...baseHeaders, 'Content-Length': contentLength, 'Content-Range': `bytes ${start}-${end}/${file.size}` })
  } else response.writeHead(200, { ...baseHeaders, 'Content-Length': file.size })
  if (request.method === 'HEAD') return response.end()
  createReadStream(filePath, { start, end })
    .on('error', error => {
      console.error(`[books] Stream error for "${filename}":`, error.message)
      if (!response.headersSent) json(response, 500, { ok: false, error: 'Book file could not be read.' }); else response.destroy()
    })
    .pipe(response)
}

const bookPreflight = response => {
  response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range, Accept, Content-Type', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range', 'Access-Control-Max-Age': '86400' })
  response.end()
}

const decodeReaderToken = token => {
  try {
    const filename = Buffer.from(token, 'base64url').toString('utf8')
    return /^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(filename) ? filename : null
  } catch {
    return null
  }
}

// The reader consumes small JSON chunks and reconstructs the PDF in memory. It
// is deliberately not a PDF HTTP response: download-manager browser extensions
// can hijack PDF/octet-stream fetches and replace them with 204.
const readBookChunkForReader = (response, token, query) => {
  const filename = decodeReaderToken(token)
  if (!filename) return json(response, 400, { ok: false, error: 'Invalid reader file token.' })
  const filePath = resolve(booksDirectory, filename)
  if (!existsSync(booksDirectory) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    console.warn(`[books] Reader data request failed for "${filename}".`)
    return json(response, 404, { ok: false, error: 'Book file not found.' })
  }
  if (extname(filename).toLowerCase() !== '.pdf') return json(response, 400, { ok: false, error: 'Reader data is only available for PDF files.' })
  const file = statSync(filePath)
  if (!file.size) return json(response, 500, { ok: false, error: 'This book file is empty on the server. Please re-upload it.' })
  const offset = Number(query.get('offset') ?? '0')
  const requestedLength = Number(query.get('length') ?? String(768 * 1024))
  const length = Math.min(Math.max(64 * 1024, Number.isInteger(requestedLength) ? requestedLength : 768 * 1024), 1024 * 1024)
  if (!Number.isInteger(offset) || offset < 0 || offset >= file.size) return json(response, 416, { ok: false, error: 'Invalid reader chunk position.' })
  const chunk = Buffer.alloc(Math.min(length, file.size - offset))
  const descriptor = openSync(filePath, 'r')
  try {
    readSync(descriptor, chunk, 0, chunk.length, offset)
  } finally {
    closeSync(descriptor)
  }
  return json(response, 200, {
    ok: true,
    encoding: 'base64',
    totalBytes: file.size,
    offset,
    nextOffset: offset + chunk.length,
    complete: offset + chunk.length >= file.size,
    data: chunk.toString('base64'),
  })
}

const readBody = (request, limit = 20_000) => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', chunk => {
    body += chunk
    if (body.length > limit) reject(new Error('Payload too large.'))
  })
  request.on('end', () => {
    try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('Invalid JSON.')) }
  })
})

const validPassword = password => typeof password === 'string' && password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)
const validEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const validStudentRegistration = identifier => /^\d{2}\/VL\/CR\/\d{3,4}$/.test(identifier)
const normalizeIdentifier = identifier => String(identifier ?? '').trim()
const normalizeOptional = value => String(value ?? '').trim() || null
const authToken = request => request.headers.authorization?.startsWith('Bearer ') ? request.headers.authorization.slice(7) : new URL(request.url ?? '/', 'http://localhost').searchParams.get('token')

const userForResponse = row => ({
  id: row.id,
  name: row.full_name,
  role: row.role,
  status: row.account_status,
  identifier: row.role === 'student' ? row.registration_number : row.lecturer_id,
  identifierType: row.role === 'student' ? 'registration_number' : 'lecturer_id',
  lecturerEmail: row.lecturer_email ?? undefined,
  profile: {
    avatarUrl: row.avatar_url ?? null,
    institution: row.institution ?? '',
    course: row.course ?? '',
    language: row.language ?? 'en',
    theme: row.theme ?? 'system',
    notificationsEnabled: Boolean(row.notifications_enabled ?? 1),
    aiEnabled: Boolean(row.ai_enabled ?? 1),
    showReadingActivity: Boolean(row.show_reading_activity ?? 1),
    saveChatHistory: Boolean(row.save_chat_history ?? 1),
  },
  verified: Boolean(row.is_verified),
  signedIn: Boolean(row.signed_in),
})

async function findUserByIdentifier(identifier) {
  const { rows } = await pool.query(
    'SELECT u.id, u.full_name, u.registration_number, u.lecturer_id, u.lecturer_email, ' +
    'u.role, u.password_hash, u.is_verified, u.account_status, p.avatar_url, p.institution, p.course, ' +
    'p.language, p.theme, p.notifications_enabled, p.ai_enabled, p.show_reading_activity, p.save_chat_history ' +
    'FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ' +
    'WHERE u.registration_number = $1 OR u.lecturer_id = $1 LIMIT 1',
    [identifier],
  )
  return rows[0] ?? null
}

async function getCurrentUser(request) {
  const token = authToken(request)
  if (!token) return null
  const { rows } = await pool.query(
    'SELECT u.id, u.full_name, u.registration_number, u.lecturer_id, u.lecturer_email, ' +
    'u.role, u.password_hash, u.is_verified, u.account_status, p.avatar_url, p.institution, p.course, ' +
    'p.language, p.theme, p.notifications_enabled, p.ai_enabled, p.show_reading_activity, p.save_chat_history ' +
    'FROM user_sessions s JOIN users u ON u.id = s.user_id ' +
    'LEFT JOIN user_profiles p ON p.user_id = u.id ' +
    'WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP LIMIT 1',
    [hashValue(token)],
  )
  const user = rows[0] ?? null
  if (user) await pool.query('UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [hashValue(token)])
  return user
}

async function requireActiveUser(request, response) {
  const user = await getCurrentUser(request)
  if (!user) { json(response, 401, { ok: false, error: 'Authentication is required.' }); return null }
  if (user.account_status === 'suspended') { json(response, 403, { ok: false, error: 'This account is suspended.' }); return null }
  if (user.account_status !== 'active') { json(response, 403, { ok: false, error: 'This account is not active.' }); return null }
  return user
}

async function requireAdministrator(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return null
  if (user.role !== 'administrator') { json(response, 403, { ok: false, error: 'Administrator permission is required.' }); return null }
  return user
}

async function requireStaff(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return null
  if (!['administrator', 'lecturer'].includes(user.role)) { json(response, 403, { ok: false, error: 'Staff permission is required.' }); return null }
  return user
}

async function recordAudit(actorId, action, entityType, entityId = null, metadata = null) {
  await pool.query(
    'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)',
    [actorId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null],
  )
}

async function issueCode(userId, purpose, details) {
  const code = createVerificationCode()
  await pool.query(
    'UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL',
    [userId, purpose],
  )
  await pool.query(
    "INSERT INTO verification_tokens (user_id, code_hash, purpose, expires_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 minute'))",
    [userId, hashValue(code), purpose, CODE_TTL_MINUTES],
  )
  console.log('\n[Cresa verification] Purpose: ' + purpose)
  console.log('Account: ' + details.identifier)
  console.log('Email: ' + details.email)
  console.log('Verification code: ' + code + ' (expires in ' + CODE_TTL_MINUTES + ' minutes)\n')
}

async function createSession(userId) {
  const token = createSessionToken()
  await pool.query(
    "INSERT INTO user_sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day'))",
    [randomUUID(), userId, hashValue(token), SESSION_TTL_DAYS],
  )
  return token
}

async function register(request, response) {
  const body = await readBody(request)
  const name = String(body.name ?? '').trim()
  const identifier = normalizeIdentifier(body.identifier)
  const password = String(body.password ?? '')
  const role = body.role === 'lecturer' ? 'lecturer' : body.role === 'student' ? 'student' : null
  const lecturerEmail = String(body.lecturerEmail ?? '').trim().toLowerCase()
  if (!role || name.length < 2 || !identifier || !validPassword(password)) return json(response, 400, { ok: false, error: 'Provide a name, identifier, valid role, and strong password.' })
  if (role === 'student' && !validStudentRegistration(identifier)) return json(response, 400, { ok: false, error: 'Student registration numbers must follow 00/VL/CR/000 or 00/VL/CR/0000.' })
  if (role === 'lecturer' && !validEmail(lecturerEmail)) return json(response, 400, { ok: false, error: 'A valid lecturer email address is required.' })
  if (await findUserByIdentifier(identifier)) return json(response, 409, { ok: false, error: 'An account already exists for this identifier.' })
  const id = randomUUID()
  await pool.query(
    'INSERT INTO users (id, full_name, registration_number, lecturer_id, lecturer_email, role, password_hash, is_verified, account_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [id, name, role === 'student' ? identifier : null, role === 'lecturer' ? identifier : null, role === 'lecturer' ? lecturerEmail : null, role, await hashPassword(password), role === 'student', role === 'student' ? 'active' : 'pending'],
  )
  await pool.query('INSERT INTO user_profiles (user_id) VALUES ($1)', [id])
  if (role === 'lecturer') await issueCode(id, 'account_verification', { identifier, email: lecturerEmail })
  return json(response, 201, { ok: true, requiresVerification: role === 'lecturer' })
}

async function verifyLecturer(request, response) {
  const body = await readBody(request)
  const identifier = normalizeIdentifier(body.lecturerId)
  const code = String(body.code ?? '')
  if (!identifier || !/^\d{6}$/.test(code)) return json(response, 400, { ok: false, error: 'Lecturer ID and a six-digit code are required.' })
  const user = await findUserByIdentifier(identifier)
  if (!user || user.role !== 'lecturer') return json(response, 404, { ok: false, error: 'Lecturer account not found.' })
  const { rows } = await pool.query(
    'SELECT id, code_hash, attempt_count FROM verification_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
    [user.id, 'account_verification'],
  )
  const token = rows[0]
  if (!token) return json(response, 400, { ok: false, error: 'Code expired or unavailable. Request a new code.' })
  if (token.attempt_count >= 5) return json(response, 429, { ok: false, error: 'Too many attempts. Request a new code.' })
  if (hashValue(code) !== token.code_hash) {
    await pool.query('UPDATE verification_tokens SET attempt_count = attempt_count + 1 WHERE id = $1', [token.id])
    return json(response, 400, { ok: false, error: 'The verification code is incorrect.' })
  }
  await pool.query('UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [token.id])
  await pool.query("UPDATE users SET is_verified = TRUE, account_status = 'active' WHERE id = $1", [user.id])
  return json(response, 200, { ok: true })
}

async function resendLecturerCode(request, response) {
  const body = await readBody(request)
  const identifier = normalizeIdentifier(body.lecturerId)
  const user = await findUserByIdentifier(identifier)
  if (!user || user.role !== 'lecturer' || !user.lecturer_email) return json(response, 404, { ok: false, error: 'Lecturer account not found.' })
  await issueCode(user.id, 'account_verification', { identifier, email: user.lecturer_email })
  return json(response, 200, { ok: true })
}

async function login(request, response) {
  const body = await readBody(request)
  const identifier = normalizeIdentifier(body.identifier)
  const password = String(body.password ?? '')
  const user = await findUserByIdentifier(identifier)
  if (!user || !(await matchesPassword(password, user.password_hash))) return json(response, 401, { ok: false, error: 'The identifier or password is incorrect.' })
  if (user.role === 'student' && !validStudentRegistration(identifier)) return json(response, 400, { ok: false, error: 'Student registration numbers must follow 00/VL/CR/000 or 00/VL/CR/0000.' })
  if (user.account_status === 'suspended') return json(response, 403, { ok: false, error: 'This account is suspended.' })
  if (!user.is_verified || user.account_status !== 'active') return json(response, 403, { ok: false, error: 'Verify your account before signing in.' })
  const sessionToken = await createSession(user.id)
  await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id])
  return json(response, 200, { ok: true, user: userForResponse(user), sessionToken })
}

async function getProfile(request, response) {
  const user = await requireActiveUser(request, response)
  if (user) json(response, 200, { ok: true, user: userForResponse(user) })
}

async function updateProfile(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request, 3 * 1024 * 1024)
  const fullName = String(body.name ?? '').trim()
  if (fullName.length < 2 || fullName.length > 150) return json(response, 400, { ok: false, error: 'Enter a valid full name.' })
  const institution = normalizeOptional(body.institution)
  const course = normalizeOptional(body.course)
  let avatarUrl = normalizeOptional(body.avatarUrl)
  if (body.avatarData) {
    const match = String(body.avatarData).match(/^data:image\/(jpeg|png|webp);base64,(.+)$/)
    if (!match) return json(response, 400, { ok: false, error: 'Choose a valid JPG, PNG, or WebP image.' })
    const image = Buffer.from(match[2], 'base64')
    if (!image.length || image.length > 2 * 1024 * 1024) return json(response, 400, { ok: false, error: 'Profile photos must be smaller than 2 MB.' })
    const avatarDirectory = resolve(serverDirectory, '..', 'public', 'assets', 'avatars')
    mkdirSync(avatarDirectory, { recursive: true })
    const extension = match[1] === 'jpeg' ? 'jpg' : match[1]
    const filename = `${user.id}.${extension}`
    writeFileSync(join(avatarDirectory, filename), image)
    avatarUrl = `/assets/avatars/${filename}`
  }
  await pool.query('UPDATE users SET full_name = $1 WHERE id = $2', [fullName, user.id])
  await pool.query('UPDATE user_profiles SET institution = $1, course = $2, avatar_url = $3 WHERE user_id = $4', [institution, course, avatarUrl, user.id])
  await recordAudit(user.id, 'profile_updated', 'user', user.id)
  return getProfile(request, response)
}

async function updatePreferences(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request)
  const theme = ['light', 'dark', 'system'].includes(body.theme) ? body.theme : 'system'
  const language = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(body.language ?? '')) ? body.language : 'en'
  const values = [Boolean(body.notificationsEnabled), Boolean(body.aiEnabled), Boolean(body.showReadingActivity), Boolean(body.saveChatHistory), theme, language, user.id]
  await pool.query(
    'UPDATE user_profiles SET notifications_enabled = $1, ai_enabled = $2, show_reading_activity = $3, save_chat_history = $4, theme = $5, language = $6 WHERE user_id = $7',
    values,
  )
  await recordAudit(user.id, 'preferences_updated', 'user', user.id)
  return getProfile(request, response)
}

async function changePassword(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request)
  const currentPassword = String(body.currentPassword ?? '')
  const nextPassword = String(body.newPassword ?? '')
  if (!(await matchesPassword(currentPassword, user.password_hash))) return json(response, 400, { ok: false, error: 'Your current password is incorrect.' })
  if (!validPassword(nextPassword)) return json(response, 400, { ok: false, error: 'Use a stronger password.' })
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(nextPassword), user.id])
  await pool.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND token_hash <> $2', [user.id, hashValue(authToken(request) ?? '')])
  await recordAudit(user.id, 'password_changed', 'user', user.id)
  return json(response, 200, { ok: true })
}

async function requestEmailChange(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  if (user.role !== 'lecturer') return json(response, 403, { ok: false, error: 'Only lecturer accounts have a verification email.' })
  const body = await readBody(request)
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!validEmail(email)) return json(response, 400, { ok: false, error: 'Enter a valid email address.' })
  await pool.query('UPDATE users SET pending_lecturer_email = $1 WHERE id = $2', [email, user.id])
  await issueCode(user.id, 'email_change', { identifier: user.lecturer_id, email })
  return json(response, 200, { ok: true })
}

async function confirmEmailChange(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request)
  const code = String(body.code ?? '')
  const { rows } = await pool.query(
    'SELECT id, code_hash, attempt_count FROM verification_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
    [user.id, 'email_change'],
  )
  const token = rows[0]
  if (!token || !/^\d{6}$/.test(code)) return json(response, 400, { ok: false, error: 'A valid verification code is required.' })
  if (token.attempt_count >= 5) return json(response, 429, { ok: false, error: 'Too many attempts. Request a new code.' })
  if (hashValue(code) !== token.code_hash) { await pool.query('UPDATE verification_tokens SET attempt_count = attempt_count + 1 WHERE id = $1', [token.id]); return json(response, 400, { ok: false, error: 'The verification code is incorrect.' }) }
  await pool.query('UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [token.id])
  await pool.query('UPDATE users SET lecturer_email = pending_lecturer_email, pending_lecturer_email = NULL WHERE id = $1', [user.id])
  await recordAudit(user.id, 'lecturer_email_changed', 'user', user.id)
  return getProfile(request, response)
}

async function deleteOwnAccount(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  await pool.query("UPDATE users SET account_status = 'suspended' WHERE id = $1", [user.id])
  await pool.query('UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1', [user.id])
  await recordAudit(user.id, 'account_deletion_requested', 'user', user.id)
  return json(response, 200, { ok: true })
}

const communityTags = value => [...new Set((Array.isArray(value) ? value : String(value ?? '').split(',')).map(tag => String(tag).trim()).filter(Boolean))].slice(0, 5)
const communityUser = row => ({ id: row.authorId, name: row.authorName, initials: row.authorName.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase(), role: row.authorRole, avatarUrl: row.authorAvatarUrl ?? null })
const mentionTokens = content => [...new Set([...String(content).matchAll(/@([A-Za-z0-9._/-]+)/g)].map(match => match[1].toLowerCase()))]

async function displayCommunityContent(content) {
  const tokens = mentionTokens(content)
  if (!tokens.length) return content
  const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',')
  const shiftedPlaceholders = tokens.map((_, i) => `$${i + 1 + tokens.length}`).join(',')
  const { rows: users } = await pool.query(
    `SELECT LOWER(registration_number) AS "registrationNumber", LOWER(lecturer_id) AS "lecturerId", full_name AS name FROM users WHERE LOWER(registration_number) IN (${placeholders}) OR LOWER(lecturer_id) IN (${shiftedPlaceholders})`,
    [...tokens, ...tokens],
  )
  return users.reduce((result, mentioned) => {
    const identifiers = [mentioned.registrationNumber, mentioned.lecturerId].filter(Boolean)
    return identifiers.reduce((text, identifier) => text.replace(new RegExp(`@${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9._/-])`, 'gi'), `@${mentioned.name}`), result)
  }, String(content))
}

async function notifyCommunityUser(userId, actorId, type, message, entityId) {
  if (userId === actorId) return
  const notificationId = randomUUID()
  await pool.query(
    'INSERT INTO notifications (id, user_id, actor_id, type, message, entity_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [notificationId, userId, actorId, type, message, entityId],
  )
  const { rows } = await pool.query(
    'SELECT n.id, n.type, n.message, n.read_at AS "readAt", n.created_at AS "createdAt", a.full_name AS "actorName" FROM notifications n LEFT JOIN users a ON a.id = n.actor_id WHERE n.id = $1 LIMIT 1',
    [notificationId],
  )
  const clients = notificationClients.get(userId) ?? []
  for (const client of clients) { client.write(`event: notification\ndata: ${JSON.stringify(rows[0])}\n\n`) }
}

async function streamNotifications(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive', 'Access-Control-Allow-Origin': allowedOrigin })
  response.write(': connected\n\n')
  const clients = notificationClients.get(user.id) ?? []
  clients.push(response); notificationClients.set(user.id, clients)
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 20_000)
  request.on('close', () => { clearInterval(heartbeat); const active = (notificationClients.get(user.id) ?? []).filter(client => client !== response); if (active.length) notificationClients.set(user.id, active); else notificationClients.delete(user.id) })
}

async function notifyCommunityMentions(content, actor, entityId) {
  const tokens = mentionTokens(content)
  if (!tokens.length) return
  const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',')
  const shiftedPlaceholders = tokens.map((_, i) => `$${i + 1 + tokens.length}`).join(',')
  const { rows: users } = await pool.query(
    `SELECT id FROM users WHERE LOWER(registration_number) IN (${placeholders}) OR LOWER(lecturer_id) IN (${shiftedPlaceholders})`,
    [...tokens, ...tokens],
  )
  for (const mentioned of users) await notifyCommunityUser(mentioned.id, actor.id, 'mention', `${actor.full_name} mentioned you in the community.`, entityId)
}

async function listNotifications(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const { rows } = await pool.query(
    'SELECT n.id, n.type, n.message, n.read_at AS "readAt", n.created_at AS "createdAt", a.full_name AS "actorName" FROM notifications n LEFT JOIN users a ON a.id = n.actor_id WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 30',
    [user.id],
  )
  const { rows: unreadRows } = await pool.query('SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL', [user.id])
  const { rows: communityUnreadRows } = await pool.query("SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1 AND read_at IS NULL AND type IN ('comment', 'reaction', 'mention')", [user.id])
  const unread = unreadRows[0]
  const communityUnread = communityUnreadRows[0]
  return json(response, 200, { ok: true, notifications: rows, unread: Number(unread.total ?? 0), communityUnread: Number(communityUnread.total ?? 0) })
}

async function readNotifications(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  await pool.query('UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read_at IS NULL', [user.id])
  return json(response, 200, { ok: true })
}

async function listCommunity(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const params = new URL(request.url, 'http://localhost').searchParams
  const tag = String(params.get('tag') ?? '').trim()
  const values = [user.id]
  let tagClause = ''
  if (tag) {
    tagClause = 'WHERE p.tags @> jsonb_build_array($2::text)'
    values.push(tag)
  }
  const { rows } = await pool.query(
    'SELECT p.id, p.author_id AS "authorId", u.full_name AS "authorName", u.role AS "authorRole", pr.avatar_url AS "authorAvatarUrl", p.content, p.tags, p.created_at AS "createdAt", ' +
    '(SELECT COUNT(*) FROM community_reactions r WHERE r.post_id = p.id) AS reactions, ' +
    'EXISTS (SELECT 1 FROM community_reactions own_reaction WHERE own_reaction.post_id = p.id AND own_reaction.user_id = $1) AS reacted, ' +
    '(SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comments ' +
    'FROM community_posts p JOIN users u ON u.id = p.author_id LEFT JOIN user_profiles pr ON pr.user_id = u.id ' + tagClause + ' ORDER BY p.created_at DESC LIMIT 50',
    values,
  )
  const posts = await Promise.all(rows.map(async row => {
    const { rows: comments } = await pool.query(
      'SELECT c.id, c.author_id AS "authorId", u.full_name AS "authorName", u.role AS "authorRole", pr.avatar_url AS "authorAvatarUrl", c.content, c.created_at AS "createdAt" FROM community_comments c JOIN users u ON u.id = c.author_id LEFT JOIN user_profiles pr ON pr.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC LIMIT 50',
      [row.id],
    )
    return { id: row.id, author: communityUser(row), content: await displayCommunityContent(row.content), tags: Array.isArray(row.tags) ? row.tags : (typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : row.tags ?? []), createdAt: row.createdAt, reactions: Number(row.reactions ?? 0), reacted: Boolean(row.reacted), comments: await Promise.all(comments.map(async comment => ({ ...comment, content: await displayCommunityContent(comment.content), author: communityUser(comment) }))) }
  }))
  return json(response, 200, { ok: true, posts })
}

async function listCommunityMentionSuggestions(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const query = String(new URL(request.url, 'http://localhost').searchParams.get('q') ?? '').trim()
  const search = `%${query}%`
  const { rows } = await pool.query(
    "SELECT id, full_name AS name, registration_number AS \"registrationNumber\", lecturer_id AS \"lecturerId\", role FROM users WHERE account_status = 'active' AND (full_name ILIKE $1 OR registration_number ILIKE $2 OR lecturer_id ILIKE $3) ORDER BY full_name LIMIT 8",
    [search, search, search],
  )
  return json(response, 200, { ok: true, accounts: rows.map(row => ({ id: row.id, name: row.name, identifier: row.registrationNumber ?? row.lecturerId, role: row.role })) })
}

async function createCommunityPost(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request)
  const content = String(body.content ?? '').trim()
  if (!content || content.length > 2000) return json(response, 400, { ok: false, error: 'Write a post between 1 and 2,000 characters.' })
  const id = randomUUID()
  await pool.query('INSERT INTO community_posts (id, author_id, content, tags) VALUES ($1, $2, $3, $4)', [id, user.id, content, JSON.stringify(communityTags(body.tags))])
  await notifyCommunityMentions(content, user, id)
  await recordAudit(user.id, 'community_post_created', 'community_post', id)
  return json(response, 201, { ok: true, id })
}

async function createCommunityComment(request, response, postId) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request)
  const content = String(body.content ?? '').trim()
  if (!validUuid(postId) || !content || content.length > 800) return json(response, 400, { ok: false, error: 'Write a comment between 1 and 800 characters.' })
  const { rows: posts } = await pool.query('SELECT id FROM community_posts WHERE id = $1 LIMIT 1', [postId])
  if (!posts.length) return json(response, 404, { ok: false, error: 'Post not found.' })
  const id = randomUUID()
  await pool.query('INSERT INTO community_comments (id, post_id, author_id, content) VALUES ($1, $2, $3, $4)', [id, postId, user.id, content])
  const { rows: postAuthorRows } = await pool.query('SELECT author_id AS "authorId" FROM community_posts WHERE id = $1', [postId])
  const post = postAuthorRows[0]
  await notifyCommunityUser(post.authorId, user.id, 'comment', `${user.full_name} commented on your community post.`, postId)
  await notifyCommunityMentions(content, user, postId)
  return json(response, 201, { ok: true, id })
}

async function toggleCommunityReaction(request, response, postId) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const { rows: posts } = await pool.query('SELECT id FROM community_posts WHERE id = $1 LIMIT 1', [postId])
  if (!posts.length) return json(response, 404, { ok: false, error: 'Post not found.' })
  const { rows: existing } = await pool.query('SELECT post_id FROM community_reactions WHERE post_id = $1 AND user_id = $2', [postId, user.id])
  if (existing.length) await pool.query('DELETE FROM community_reactions WHERE post_id = $1 AND user_id = $2', [postId, user.id])
  else await pool.query('INSERT INTO community_reactions (post_id, user_id) VALUES ($1, $2)', [postId, user.id])
  if (!existing.length) {
    const { rows: postAuthorRows } = await pool.query('SELECT author_id AS "authorId" FROM community_posts WHERE id = $1', [postId])
    const post = postAuthorRows[0]
    await notifyCommunityUser(post.authorId, user.id, 'reaction', `${user.full_name} reacted to your community post.`, postId)
  }
  const { rows: countRows } = await pool.query('SELECT COUNT(*) AS total FROM community_reactions WHERE post_id = $1', [postId])
  const count = countRows[0]
  return json(response, 200, { ok: true, reacted: !existing.length, reactions: Number(count.total ?? 0) })
}

async function listCommunityCircles(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const defaults = [['Design notes', 'Share visual thinking, tools, and creative process.'], ['Study sessions', 'Find focus partners and exchange study routines.'], ['Fiction club', 'Talk about stories, characters, and memorable lines.']]
  for (const [name, description] of defaults) {
    await pool.query('INSERT INTO community_circles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING', [randomUUID(), name, description])
  }
  const { rows } = await pool.query(
    'SELECT c.id, c.name, c.description, COUNT(m.user_id) AS members, EXISTS (SELECT 1 FROM community_memberships own_membership WHERE own_membership.circle_id = c.id AND own_membership.user_id = $1) AS joined FROM community_circles c LEFT JOIN community_memberships m ON m.circle_id = c.id GROUP BY c.id ORDER BY members DESC, c.name',
    [user.id],
  )
  return json(response, 200, { ok: true, circles: rows.map(circle => ({ ...circle, members: Number(circle.members), joined: Boolean(circle.joined) })) })
}

async function toggleCommunityCircle(request, response, circleId) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const { rows: circles } = await pool.query('SELECT id FROM community_circles WHERE id = $1 LIMIT 1', [circleId])
  if (!circles.length) return json(response, 404, { ok: false, error: 'Circle not found.' })
  const { rows: existing } = await pool.query('SELECT circle_id FROM community_memberships WHERE circle_id = $1 AND user_id = $2', [circleId, user.id])
  if (existing.length) await pool.query('DELETE FROM community_memberships WHERE circle_id = $1 AND user_id = $2', [circleId, user.id])
  else await pool.query('INSERT INTO community_memberships (circle_id, user_id) VALUES ($1, $2)', [circleId, user.id])
  return json(response, 200, { ok: true, joined: !existing.length })
}

async function listUsers(request, response) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const params = new URL(request.url, 'http://localhost').searchParams
  const clauses = []; const values = []
  let paramIndex = 1
  if (['student', 'lecturer', 'administrator'].includes(params.get('role'))) { clauses.push(`u.role = $${paramIndex++}`); values.push(params.get('role')) }
  if (['active', 'pending', 'suspended'].includes(params.get('status'))) { clauses.push(`u.account_status = $${paramIndex++}`); values.push(params.get('status')) }
  if (params.get('q')) {
    clauses.push(`(u.full_name ILIKE $${paramIndex} OR u.lecturer_email ILIKE $${paramIndex + 1} OR u.registration_number ILIKE $${paramIndex + 2} OR u.lecturer_id ILIKE $${paramIndex + 3})`)
    values.push(...Array(4).fill(`%${params.get('q')}%`))
    paramIndex += 4
  }
  const { rows } = await pool.query(
    'SELECT u.id, u.full_name, u.registration_number, u.lecturer_id, u.lecturer_email, u.role, u.is_verified, u.account_status, u.created_at, u.last_login_at, p.course, EXISTS (SELECT 1 FROM user_sessions active_session WHERE active_session.user_id = u.id AND active_session.revoked_at IS NULL AND active_session.expires_at > CURRENT_TIMESTAMP) AS signed_in FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id ' + (clauses.length ? `WHERE ${clauses.join(' AND ')} ` : '') + 'ORDER BY u.created_at DESC LIMIT 200',
    values,
  )
  return json(response, 200, { ok: true, users: rows.map(userForResponse) })
}

async function createStudentAccount(request, response) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const body = await readBody(request)
  const name = String(body.name ?? '').trim()
  const identifier = normalizeIdentifier(body.identifier)
  const password = String(body.password ?? '')
  const course = normalizeOptional(body.course)
  if (name.length < 2 || !identifier || !validPassword(password)) return json(response, 400, { ok: false, error: 'Provide a name, registration number, and strong password.' })
  if (!validStudentRegistration(identifier)) return json(response, 400, { ok: false, error: 'Student registration numbers must follow 00/VL/CR/000 or 00/VL/CR/0000.' })
  if (await findUserByIdentifier(identifier)) return json(response, 409, { ok: false, error: 'An account already exists for this identifier.' })
  const id = randomUUID()
  await pool.query("INSERT INTO users (id, full_name, registration_number, role, password_hash, is_verified, account_status) VALUES ($1, $2, $3, 'student', $4, TRUE, 'active')", [id, name, identifier, await hashPassword(password)])
  await pool.query('INSERT INTO user_profiles (user_id, course) VALUES ($1, $2)', [id, course])
  await recordAudit(staff.id, 'student_account_created', 'user', id, { name, identifier })
  return json(response, 201, { ok: true })
}

async function updateStudentAccount(request, response, id) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const body = await readBody(request)
  const { rows } = await pool.query('SELECT full_name, registration_number, lecturer_id, role FROM users WHERE id = $1', [id])
  const account = rows[0]
  if (!account) return json(response, 404, { ok: false, error: 'Account not found.' })
  const name = String(body.name ?? account.full_name).trim()
  const identifier = normalizeIdentifier(body.identifier ?? (account.role === 'student' ? account.registration_number : account.lecturer_id))
  const course = normalizeOptional(body.course)
  const password = String(body.password ?? '')
  if (name.length < 2 || !identifier) return json(response, 400, { ok: false, error: 'A name and registration number are required.' })
  if (account.role === 'student' && !validStudentRegistration(identifier)) return json(response, 400, { ok: false, error: 'Student registration numbers must follow 00/VL/CR/000 or 00/VL/CR/0000.' })
  if (password && !validPassword(password)) return json(response, 400, { ok: false, error: 'The password must contain uppercase, lowercase, and a number.' })
  const identifierColumn = account.role === 'student' ? 'registration_number' : 'lecturer_id'
  const { rows: duplicate } = await pool.query(`SELECT id FROM users WHERE ${identifierColumn} = $1 AND id <> $2 LIMIT 1`, [identifier, id])
  if (duplicate.length) return json(response, 409, { ok: false, error: 'An account already exists for this identifier.' })
  const identifierUpdate = account.role === 'student' ? 'registration_number' : 'lecturer_id'
  if (password) await pool.query(`UPDATE users SET full_name = $1, ${identifierUpdate} = $2, password_hash = $3 WHERE id = $4`, [name, identifier, await hashPassword(password), id])
  else await pool.query(`UPDATE users SET full_name = $1, ${identifierUpdate} = $2 WHERE id = $3`, [name, identifier, id])
  await pool.query('INSERT INTO user_profiles (user_id, course) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET course = EXCLUDED.course', [id, course])
  await recordAudit(staff.id, 'account_updated', 'user', id, { name, identifier, role: account.role })
  return json(response, 200, { ok: true })
}

async function userAuditHistory(request, response, id) {
  const admin = await requireAdministrator(request, response); if (!admin) return
  const { rows: history } = await pool.query('SELECT action, metadata, created_at AS "createdAt" FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 30', ['user', id])
  const { rows: activityRows } = await pool.query('SELECT COUNT(*) AS saved, COALESCE(AVG(progress_percent), 0) AS "averageProgress" FROM reading_progress WHERE user_id = $1', [id])
  const activity = activityRows[0]
  return json(response, 200, { ok: true, history, activity: { saved: Number(activity.saved ?? 0), averageProgress: Math.round(Number(activity.averageProgress ?? 0)) } })
}

async function adminResendVerification(request, response, id) {
  const admin = await requireAdministrator(request, response); if (!admin) return
  const { rows } = await pool.query('SELECT id, role, lecturer_id, lecturer_email FROM users WHERE id = $1', [id])
  const account = rows[0]
  if (!account || account.role !== 'lecturer' || !account.lecturer_email) return json(response, 400, { ok: false, error: 'Only lecturer accounts with an email can be verified.' })
  await issueCode(account.id, 'account_verification', { identifier: account.lecturer_id, email: account.lecturer_email }); await recordAudit(admin.id, 'verification_resent', 'user', id)
  return json(response, 200, { ok: true })
}

async function updateUserAccess(request, response, id) {
  const admin = await requireAdministrator(request, response)
  if (!admin) return
  const body = await readBody(request)
  const status = ['active', 'pending', 'suspended'].includes(body.status) ? body.status : null
  const role = ['student', 'lecturer', 'administrator'].includes(body.role) ? body.role : null
  if (!status && !role) return json(response, 400, { ok: false, error: 'Choose an account status or role.' })
  if (id === admin.id && (status === 'suspended' || role && role !== 'administrator')) return json(response, 400, { ok: false, error: 'Administrators cannot remove their own access.' })
  if (status && role) await pool.query('UPDATE users SET account_status = $1, role = $2 WHERE id = $3', [status, role, id])
  else if (status) await pool.query('UPDATE users SET account_status = $1 WHERE id = $2', [status, id])
  else await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id])
  await recordAudit(admin.id, 'user_access_updated', 'user', id, { status, role })
  return json(response, 200, { ok: true })
}

async function deleteStudent(request, response, id) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const { rows } = await pool.query('SELECT role, full_name FROM users WHERE id = $1', [id])
  const student = rows[0]
  if (!student || student.role !== 'student') return json(response, 404, { ok: false, error: 'Student account not found.' })
  await recordAudit(staff.id, 'student_account_deleted', 'user', id, { name: student.full_name })
  await pool.query('DELETE FROM users WHERE id = $1', [id])
  return json(response, 200, { ok: true })
}

const safeResourceFileName = name => basename(String(name ?? '').trim()).replace(/[^A-Za-z0-9._-]/g, '-')
const adminResourceRow = row => ({ ...row, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, publishedAt: row.published_at })

async function getAdminDashboard(request, response) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const daysValue = Number(new URL(request.url, 'http://localhost').searchParams.get('days'))
  const days = [7, 30, 90, 365].includes(daysValue) ? daysValue : 30
  const { rows: userMetricsRows } = await pool.query(
    "SELECT COUNT(*) AS \"totalUsers\", SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS \"activeUsers\" FROM users",
  )
  const userMetrics = userMetricsRows[0]
  const { rows: resourceMetricsRows } = await pool.query(
    "SELECT SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts, SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived FROM resources",
  )
  const resourceMetrics = resourceMetricsRows[0]
  const { rows: registrations } = await pool.query('SELECT full_name AS name, role, created_at AS "createdAt" FROM users ORDER BY created_at DESC LIMIT 6')
  const { rows: uploads } = await pool.query('SELECT title, status, created_at AS "createdAt" FROM resources ORDER BY created_at DESC LIMIT 6')
  const { rows: aiUsageRows } = await pool.query(
    "SELECT COUNT(*) AS requests FROM audit_logs WHERE action = 'ai_request' AND created_at >= NOW() - ($1 * INTERVAL '1 day')",
    [days],
  )
  const aiUsage = aiUsageRows[0]
  const { rows: readingRows } = await pool.query(
    "SELECT COUNT(*) AS \"activeReaders\", COALESCE(AVG(progress_percent), 0) AS \"averageProgress\" FROM reading_progress WHERE last_read_at >= NOW() - ($1 * INTERVAL '1 day')",
    [days],
  )
  const reading = readingRows[0]
  const { rows: failedProcessing } = await pool.query(
    "SELECT title, status, updated_at AS \"updatedAt\" FROM resources WHERE file_path IS NULL OR (status = 'published' AND (file_size_bytes IS NULL OR file_size_bytes = 0)) ORDER BY updated_at DESC LIMIT 8",
  )
  return json(response, 200, {
    ok: true, rangeDays: days,
    metrics: {
      totalUsers: Number(userMetrics.totalUsers ?? 0),
      activeUsers: Number(userMetrics.activeUsers ?? 0),
      published: Number(resourceMetrics.published ?? 0),
      drafts: Number(resourceMetrics.drafts ?? 0),
      archived: Number(resourceMetrics.archived ?? 0),
      aiRequests: Number(aiUsage.requests ?? 0),
      activeReaders: Number(reading.activeReaders ?? 0),
      averageProgress: Math.round(Number(reading.averageProgress ?? 0)),
    },
    registrations, uploads, failedProcessing,
  })
}

async function listAdminResources(request, response, search = '') {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const params = new URLSearchParams(search)
  const values = []
  const clauses = []
  let paramIndex = 1
  for (const [field, value] of [['status', params.get('status')], ['category', params.get('category')], ['course', params.get('course')]]) {
    if (value && value !== 'all') { clauses.push(`${field} ILIKE $${paramIndex++}`); values.push(`%${value}%`) }
  }
  const dateFrom = params.get('from')
  const dateTo = params.get('to')
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) { clauses.push(`created_at >= $${paramIndex++}`); values.push(dateFrom) }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) { clauses.push(`created_at < $${paramIndex}::DATE + INTERVAL '1 day'`); values.push(dateTo); paramIndex++ }
  if (params.get('q')) {
    clauses.push(`(title ILIKE $${paramIndex} OR author ILIKE $${paramIndex + 1} OR category ILIKE $${paramIndex + 2} OR subject ILIKE $${paramIndex + 3} OR course ILIKE $${paramIndex + 4} OR tags::text ILIKE $${paramIndex + 5})`)
    values.push(...Array(6).fill(`%${params.get('q')}%`))
    paramIndex += 6
  }
  const { rows } = await pool.query(
    'SELECT id, title, author, description, resource_type AS "resourceType", category, subject, course, tags, publication_year AS "publicationYear", file_path AS "filePath", file_size_bytes AS "fileSizeBytes", page_count AS "pageCount", status, created_at, updated_at, published_at FROM resources ' +
    (clauses.length ? `WHERE ${clauses.join(' AND ')} ` : '') + 'ORDER BY updated_at DESC LIMIT 250',
    values,
  )
  return json(response, 200, { ok: true, resources: rows.map(adminResourceRow) })
}

async function listPublicCatalogue(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const { rows } = await pool.query(
    "SELECT id, title, author, description, resource_type AS \"resourceType\", course, file_path AS \"filePath\", file_size_bytes AS \"fileSizeBytes\", status FROM resources WHERE status = 'published' ORDER BY updated_at DESC LIMIT 250",
  )
  return json(response, 200, { ok: true, resources: rows.map(row => ({ id: row.id, title: row.title, author: row.author, description: row.description ?? '', resourceType: row.resourceType, course: row.course ?? '', filePath: row.filePath, fileSizeBytes: row.fileSizeBytes, status: row.status })) })
}

async function saveAdminResource(request, response, id = null) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const body = await readBody(request, 72_000_000)
  let existing = null
  if (id) {
    const { rows } = await pool.query('SELECT title, author, description, resource_type, category, subject, course, tags, publication_year, file_path, file_size_bytes, page_count, status FROM resources WHERE id = $1', [id])
    existing = rows[0] ?? null
    if (!existing) return json(response, 404, { ok: false, error: 'Resource not found.' })
  }
  const title = String(body.title ?? existing?.title ?? '').trim()
  const author = String(body.author ?? existing?.author ?? 'CRESA Learning Library').trim()
  const status = ['draft', 'published', 'archived'].includes(body.status) ? body.status : (existing?.status ?? 'draft')
  if (!title || !author) return json(response, 400, { ok: false, error: 'A title and author are required.' })
  let filePath = body.filePath ? String(body.filePath) : existing?.file_path ?? null
  let fileSizeBytes = Number(body.fileSizeBytes) || existing?.file_size_bytes || null
  if (body.fileData) {
    const filename = safeResourceFileName(body.fileName)
    const fileType = String(body.fileType ?? '')
    const file = Buffer.from(String(body.fileData), 'base64')
    if (!filename.toLowerCase().endsWith('.pdf') || fileType !== 'application/pdf') return json(response, 400, { ok: false, error: 'Only PDF files are accepted.' })
    if (!file.length || file.length > 50 * 1024 * 1024) return json(response, 400, { ok: false, error: 'The PDF must be between 1 byte and 50 MB.' })
    mkdirSync(booksDirectory, { recursive: true })
    const savedName = `${Date.now()}-${filename}`
    writeFileSync(join(booksDirectory, savedName), file)
    filePath = `/books/${savedName}`
    fileSizeBytes = file.length
  }
  const tagValues = Array.isArray(body.tags) ? body.tags : typeof body.tags === 'string' ? body.tags.split(',') : existing?.tags ?? []
  const tags = [...new Set(tagValues.map(tag => String(tag).trim()).filter(Boolean))].slice(0, 30)
  const values = [title, author, String(body.description ?? existing?.description ?? '').trim() || null, ['book', 'journal', 'article', 'pdf', 'other'].includes(body.resourceType) ? body.resourceType : (existing?.resource_type ?? 'pdf'), String(body.category ?? existing?.category ?? '').trim() || null, String(body.subject ?? existing?.subject ?? '').trim() || null, String(body.course ?? existing?.course ?? '').trim() || null, JSON.stringify(tags), Number(body.publicationYear) || existing?.publication_year || null, filePath, fileSizeBytes, Number(body.pageCount) || existing?.page_count || null, status]
  if (!id) {
    const resourceId = randomUUID()
    await pool.query(
      "INSERT INTO resources (id, created_by, title, author, description, resource_type, category, subject, course, tags, publication_year, file_path, file_size_bytes, page_count, status, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $16 = 'published' THEN NOW() ELSE NULL END)",
      [resourceId, staff.id, ...values, status],
    )
    await recordAudit(staff.id, 'resource_created', 'resource', resourceId, { title, status, hasFile: Boolean(filePath) })
    return json(response, 201, { ok: true, id: resourceId })
  }
  await pool.query(
    "UPDATE resources SET title=$1, author=$2, description=$3, resource_type=$4, category=$5, subject=$6, course=$7, tags=$8, publication_year=$9, file_path=COALESCE($10, file_path), file_size_bytes=COALESCE($11, file_size_bytes), page_count=$12, status=$13, published_at=CASE WHEN $14 = 'published' THEN COALESCE(published_at, NOW()) ELSE NULL END WHERE id=$15",
    [...values, status, id],
  )
  await recordAudit(staff.id, 'resource_updated', 'resource', id, { title, status, replacedFile: Boolean(body.fileData) })
  return json(response, 200, { ok: true, id })
}

async function deleteAdminResource(request, response, id) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const { rows } = await pool.query('SELECT title, file_path FROM resources WHERE id = $1', [id])
  const resource = rows[0]
  if (!resource) return json(response, 404, { ok: false, error: 'Resource not found.' })
  await pool.query('DELETE FROM resources WHERE id = $1', [id])
  if (resource.file_path?.startsWith('/books/')) { const path = resolve(booksDirectory, basename(resource.file_path)); if (path.startsWith(booksDirectory + sep) && existsSync(path)) unlinkSync(path) }
  await recordAudit(staff.id, 'resource_deleted', 'resource', id, { title: resource.title })
  return json(response, 200, { ok: true })
}

async function resourceAuditHistory(request, response, id) {
  const staff = await requireStaff(request, response)
  if (!staff) return
  const { rows } = await pool.query('SELECT action, metadata, created_at AS "createdAt" FROM audit_logs WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 30', ['resource', id])
  return json(response, 200, { ok: true, history: rows.map(row => ({ action: row.action, createdAt: row.createdAt, metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata })) })
}

const validUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const aiHistoryEnabled = user => Boolean(user.save_chat_history ?? 1)

async function getOwnedConversation(userId, id) {
  if (!validUuid(id)) return null
  const { rows } = await pool.query(
    'SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM ai_conversations WHERE id = $1 AND user_id = $2 LIMIT 1',
    [id, userId],
  )
  return rows[0] ?? null
}

async function conversationWithMessages(userId, conversation) {
  const { rows: messages } = await pool.query(
    'SELECT m.id, m.role, m.content, m.source_context AS context, m.created_at AS "createdAt" FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id AND c.user_id = $1 WHERE m.conversation_id = $2 ORDER BY m.created_at ASC, m.id ASC LIMIT 150',
    [userId, conversation.id],
  )
  return { ...conversation, messages }
}

async function listAiConversations(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  if (!aiHistoryEnabled(user)) return json(response, 200, { ok: true, enabled: false, conversations: [] })
  const { rows } = await pool.query(
    'SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM ai_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20',
    [user.id],
  )
  const conversations = await Promise.all(rows.map(row => conversationWithMessages(user.id, row)))
  return json(response, 200, { ok: true, enabled: true, conversations })
}

async function updateAiConversation(request, response, id) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  if (!aiHistoryEnabled(user)) return json(response, 403, { ok: false, error: 'Chat history is disabled in Preferences.' })
  const conversation = await getOwnedConversation(user.id, id)
  if (!conversation) return json(response, 404, { ok: false, error: 'Conversation not found.' })
  const body = await readBody(request)
  const title = String(body.title ?? '').trim().slice(0, 120)
  if (!title) return json(response, 400, { ok: false, error: 'Enter a conversation name.' })
  await pool.query('UPDATE ai_conversations SET title = $1 WHERE id = $2 AND user_id = $3', [title, id, user.id])
  return json(response, 200, { ok: true, title })
}

async function deleteAiConversation(request, response, id) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  if (!aiHistoryEnabled(user)) return json(response, 403, { ok: false, error: 'Chat history is disabled in Preferences.' })
  const result = await pool.query('DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2', [id, user.id])
  if (!result.rowCount) return json(response, 404, { ok: false, error: 'Conversation not found.' })
  return json(response, 200, { ok: true })
}

async function ensureAiConversation(user, requestedId, title) {
  const requestedConversationId = validUuid(requestedId) ? requestedId : null
  const existing = requestedConversationId ? await getOwnedConversation(user.id, requestedConversationId) : null
  if (existing) return existing
  const id = randomUUID()
  await pool.query('INSERT INTO ai_conversations (id, user_id, title) VALUES ($1, $2, $3)', [id, user.id, title.slice(0, 120) || 'New academic conversation'])
  return getOwnedConversation(user.id, id)
}

async function askGemini(request, response) {
  const user = await requireActiveUser(request, response)
  if (!user) return
  const body = await readBody(request, 100_000)
  const prompt = String(body.prompt ?? '').trim()
  if (!prompt || prompt.length > 12_000) return json(response, 400, { ok: false, error: 'Enter a question of up to 12,000 characters.' })
  if (!GEMINI_API_KEY) return json(response, 503, { ok: false, error: 'Gemini is not configured. Add GEMINI_API_KEY to the server environment.' })
  const context = body.resource ? `Current resource: ${String(body.resource.title ?? '').slice(0, 180)}. Course: ${String(body.resource.courseCode ?? '').slice(0, 80)}. Page: ${Number(body.resource.page) || 'not specified'}.` : 'No specific resource is open.'
  let conversation = null
  let messages = Array.isArray(body.messages) ? body.messages.slice(-12) : []
  if (aiHistoryEnabled(user)) {
    conversation = await ensureAiConversation(user, body.conversationId, prompt)
    const { rows: storedMessages } = await pool.query(
      'SELECT role, content FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT 12',
      [conversation.id],
    )
    messages = storedMessages.reverse()
  }
  const contents = [...messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(message.content ?? '').slice(0, 12_000) }] })), { role: 'user', parts: [{ text: `${context}\n\nStudent request: ${prompt}` }] }]
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ systemInstruction: { parts: [{ text: 'You are CresaBot, a careful academic reading assistant for Cresa E-library. Explain concepts clearly, identify uncertainty, do not invent source details, and encourage independent learning. Keep answers concise unless asked otherwise.' }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 1200 } }) })
    const payload = await geminiResponse.json()
    if (!geminiResponse.ok) { const message = payload?.error?.message ?? 'Gemini could not complete this request.'; return json(response, geminiResponse.status === 429 ? 429 : 502, { ok: false, error: message }) }
    const answer = payload?.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('')?.trim()
    if (!answer) return json(response, 502, { ok: false, error: 'Gemini returned no answer.' })
    if (conversation) {
      const sourceContext = body.resource?.page ? `Page ${body.resource.page}` : null
      await pool.query(
        'INSERT INTO ai_messages (id, conversation_id, role, content, source_context) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
        [randomUUID(), conversation.id, 'user', prompt, sourceContext, randomUUID(), conversation.id, 'assistant', answer, sourceContext],
      )
      await pool.query(
        "UPDATE ai_conversations SET title = CASE WHEN title = 'New academic conversation' THEN $1 ELSE title END, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3",
        [prompt.slice(0, 120), conversation.id, user.id],
      )
    }
    await recordAudit(user.id, 'ai_request', 'ai', null, { model: GEMINI_MODEL, resourceTitle: body.resource?.title ? String(body.resource.title).slice(0, 180) : null, promptCharacters: prompt.length, responseCharacters: answer.length })
    return json(response, 200, { ok: true, answer, context: body.resource?.page ? `Page ${body.resource.page}` : null, conversationId: conversation?.id ?? null })
  } catch (error) {
    return json(response, error?.name === 'AbortError' ? 504 : 502, { ok: false, error: error?.name === 'AbortError' ? 'Gemini timed out. Please try again.' : 'Gemini is temporarily unavailable.' })
  } finally { clearTimeout(timeout) }
}

const server = createServer(async (request, response) => {
    const bookMatch = request.url?.match(/^\/api\/books\/([^/?#]+)$/)
    const readerStreamMatch = request.url?.match(/^\/api\/reader-content\/([A-Za-z0-9_-]+)$/)
    const readerChunkMatch = request.url?.match(/^\/api\/reader-chunks\/([A-Za-z0-9_-]+)(?:\?([^#]*))?$/)
    if (request.method === 'OPTIONS' && (bookMatch || readerStreamMatch || readerChunkMatch)) return bookPreflight(response)
    if (request.method === 'OPTIONS') return json(response, 204, {})
    if (request.method === 'GET' && request.url === '/api/books-status') return reportBooksStatus(request, response)
    if ((request.method === 'GET' || request.method === 'HEAD') && bookMatch) return streamBook(request, response, bookMatch[1])
    if (request.method === 'GET' && readerChunkMatch) return readBookChunkForReader(response, readerChunkMatch[1], new URLSearchParams(readerChunkMatch[2] ?? ''))
    if ((request.method === 'GET' || request.method === 'HEAD') && readerStreamMatch) {
      const filename = decodeReaderToken(readerStreamMatch[1])
      if (!filename) return json(response, 400, { ok: false, error: 'Invalid reader file token.' })
      return streamBook(request, response, filename, { readerStream: true })
    }
  try {
    if (request.method === 'POST' && request.url === '/api/auth/register') return register(request, response)
    if (request.method === 'POST' && request.url === '/api/auth/lecturer/verify') return verifyLecturer(request, response)
    if (request.method === 'POST' && request.url === '/api/auth/lecturer/resend-code') return resendLecturerCode(request, response)
    if (request.method === 'POST' && request.url === '/api/auth/login') return login(request, response)
    if (request.method === 'GET' && request.url === '/api/me') return getProfile(request, response)
    if (request.method === 'PATCH' && request.url === '/api/me/profile') return updateProfile(request, response)
    if (request.method === 'PATCH' && request.url === '/api/me/preferences') return updatePreferences(request, response)
    if (request.method === 'POST' && request.url === '/api/me/change-password') return changePassword(request, response)
    if (request.method === 'POST' && request.url === '/api/me/email-change/request') return requestEmailChange(request, response)
    if (request.method === 'POST' && request.url === '/api/me/email-change/confirm') return confirmEmailChange(request, response)
    if (request.method === 'DELETE' && request.url === '/api/me') return deleteOwnAccount(request, response)
    if (request.method === 'GET' && request.url === '/api/notifications') return listNotifications(request, response)
    if (request.method === 'POST' && request.url === '/api/notifications/read') return readNotifications(request, response)
    if (request.method === 'GET' && request.url?.startsWith('/api/notifications/stream')) return streamNotifications(request, response)
    if (request.method === 'GET' && request.url?.match(/^\/api\/community(?:\?[^#]*)?$/)) return listCommunity(request, response)
    if (request.method === 'GET' && request.url?.match(/^\/api\/community\/mentions\?q=/)) return listCommunityMentionSuggestions(request, response)
    if (request.method === 'POST' && request.url === '/api/community/posts') return createCommunityPost(request, response)
    if (request.method === 'GET' && request.url === '/api/community/circles') return listCommunityCircles(request, response)
    const communityPostMatch = request.url?.match(/^\/api\/community\/posts\/([0-9a-f-]{36})\/comments$/i)
    if (request.method === 'POST' && communityPostMatch) return createCommunityComment(request, response, communityPostMatch[1])
    const communityReactionMatch = request.url?.match(/^\/api\/community\/posts\/([0-9a-f-]{36})\/reaction$/i)
    if (request.method === 'POST' && communityReactionMatch) return toggleCommunityReaction(request, response, communityReactionMatch[1])
    const communityCircleMatch = request.url?.match(/^\/api\/community\/circles\/([0-9a-f-]{36})\/membership$/i)
    if (request.method === 'POST' && communityCircleMatch) return toggleCommunityCircle(request, response, communityCircleMatch[1])
    if (request.method === 'GET' && request.url?.match(/^\/api\/admin\/users(?:\?[^#]*)?$/)) return listUsers(request, response)
    if (request.method === 'POST' && request.url === '/api/admin/users') return createStudentAccount(request, response)
    if (request.method === 'GET' && request.url?.match(/^\/api\/admin\/dashboard(?:\?[^#]*)?$/)) return getAdminDashboard(request, response)
    if (request.method === 'GET' && request.url === '/api/catalogue') return listPublicCatalogue(request, response)
    const adminResourcesMatch = request.url?.match(/^\/api\/admin\/resources(?:\?([^#]*))?$/)
    if (request.method === 'GET' && adminResourcesMatch) return listAdminResources(request, response, adminResourcesMatch[1] ?? '')
    if (request.method === 'POST' && request.url === '/api/admin/resources') return saveAdminResource(request, response)
    const adminResourceMatch = request.url?.match(/^\/api\/admin\/resources\/([0-9a-f-]{36})$/i)
    const resourceAuditMatch = request.url?.match(/^\/api\/admin\/resources\/([0-9a-f-]{36})\/audit$/i)
    if (request.method === 'GET' && resourceAuditMatch) return resourceAuditHistory(request, response, resourceAuditMatch[1])
    if (request.method === 'PATCH' && adminResourceMatch) return saveAdminResource(request, response, adminResourceMatch[1])
    if (request.method === 'DELETE' && adminResourceMatch) return deleteAdminResource(request, response, adminResourceMatch[1])
    if (request.method === 'GET' && request.url === '/api/ai/conversations') return listAiConversations(request, response)
    const aiConversationMatch = request.url?.match(/^\/api\/ai\/conversations\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && aiConversationMatch) return updateAiConversation(request, response, aiConversationMatch[1])
    if (request.method === 'DELETE' && aiConversationMatch) return deleteAiConversation(request, response, aiConversationMatch[1])
    if (request.method === 'POST' && request.url === '/api/ai/chat') return askGemini(request, response)
    const accessMatch = request.url?.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/access$/i)
    if (request.method === 'PATCH' && accessMatch) return updateUserAccess(request, response, accessMatch[1])
    const studentEditMatch = request.url?.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/i)
    if (request.method === 'PATCH' && studentEditMatch) return updateStudentAccount(request, response, studentEditMatch[1])
    const userAuditMatch = request.url?.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/audit$/i)
    if (request.method === 'GET' && userAuditMatch) return userAuditHistory(request, response, userAuditMatch[1])
    const verificationMatch = request.url?.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/resend-verification$/i)
    if (request.method === 'POST' && verificationMatch) return adminResendVerification(request, response, verificationMatch[1])
    const studentMatch = request.url?.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/i)
    if (request.method === 'DELETE' && studentMatch) return deleteStudent(request, response, studentMatch[1])
    return json(response, 404, { ok: false, error: 'Route not found.' })
  } catch (error) {
    console.error(error)
    return json(response, 500, { ok: false, error: 'The server could not complete this request.' })
  }
})

reportBooksDirectoryStatus()

requireDatabase()
  .then(async () => {
    const PORT = await getAvailablePort(DEFAULT_PORT)
    server.listen(PORT, () => console.log('Cresa API server running on http://localhost:' + PORT))
  })
  .catch(error => { console.error('Database connection failed.', error.message); process.exitCode = 1 })
