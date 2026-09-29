import { createId } from '../utils/id'

export type Role = 'student' | 'lecturer' | 'administrator'
export type IdentifierType = 'registration_number' | 'lecturer_id'

export type AuthUser = {
  id: string
  name: string
  identifier: string
  identifierType: IdentifierType
  lecturerEmail?: string
  role: Role
  status?: 'active' | 'pending' | 'suspended'
  signedIn?: boolean
  profile?: {
    avatarUrl?: string | null
    institution?: string
    course?: string
    language?: string
    theme?: 'light' | 'dark' | 'system'
    notificationsEnabled?: boolean
    aiEnabled?: boolean
    showReadingActivity?: boolean
    saveChatHistory?: boolean
  }
  verified: boolean
}

type StoredAccount = AuthUser & { password: string }
type LegacyAccount = Partial<StoredAccount> & { email?: string }
type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string }

const ACCOUNT_KEY = 'cresa.accounts.v1'
const SESSION_KEY = 'cresa.session.v1'
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7

const normalizeRole = (role: unknown): Role => role === 'student' ? 'student' : role === 'administrator' ? 'administrator' : 'lecturer'
const identifierTypeFor = (role: Role): IdentifierType => role === 'student' ? 'registration_number' : 'lecturer_id'
const publicUser = (account: StoredAccount): AuthUser => ({ id: account.id, name: account.name, identifier: account.identifier, identifierType: account.identifierType, lecturerEmail: account.lecturerEmail, role: account.role, profile: account.profile, verified: account.verified })

const getAccounts = (): StoredAccount[] => {
  const records = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? '[]') as LegacyAccount[]
  return records.map(record => {
    const role = normalizeRole(record.role)
    return {
      id: record.id ?? createId(),
      name: record.name ?? 'Cresa Reader',
      identifier: record.identifier ?? record.email ?? '',
      identifierType: identifierTypeFor(role),
      password: record.password ?? '',
      lecturerEmail: record.lecturerEmail,
      role,
      profile: record.profile,
      verified: Boolean(record.verified),
    }
  })
}

const setAccounts = (accounts: StoredAccount[]) => localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts))

export const passwordIssue = (password: string) => {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Z]/.test(password)) return 'Add one uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Add one lowercase letter.'
  if (!/\d/.test(password)) return 'Add one number.'
  return ''
}

export const validStudentRegistration = (identifier: string) => /^\d{2}\/VL\/CR\/\d{3,4}$/.test(identifier.trim())

export function registerAccount(input: { name: string; identifier: string; password: string; role: Role; lecturerEmail?: string }): AuthResult {
  const name = input.name.trim()
  const identifier = input.identifier.trim()
  if (name.length < 2) return { ok: false, error: 'Enter your full name.' }
  if (!identifier) return { ok: false, error: input.role === 'student' ? 'Enter your registration number.' : 'Enter your Lecturer ID.' }
  const lecturerEmail = input.lecturerEmail?.trim().toLowerCase()
  if (input.role === 'lecturer' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lecturerEmail ?? '')) return { ok: false, error: 'Enter a valid lecturer email address.' }
  const issue = passwordIssue(input.password)
  if (issue) return { ok: false, error: issue }
  const accounts = getAccounts()
  if (accounts.some(account => account.identifier.toLowerCase() === identifier.toLowerCase())) return { ok: false, error: 'An account already exists for this identifier.' }
  const account: StoredAccount = { id: createId(), name, identifier, identifierType: identifierTypeFor(input.role), lecturerEmail: input.role === 'lecturer' ? lecturerEmail : undefined, password: input.password, role: input.role, verified: false }
  setAccounts([...accounts, account])
  return { ok: true, user: publicUser(account) }
}

export function loginAccount(identifierInput: string, password: string): AuthResult {
  const identifier = identifierInput.trim().toLowerCase()
  const account = getAccounts().find(item => item.identifier.toLowerCase() === identifier)
  if (!account || account.password !== password) return { ok: false, error: 'The identifier or password is incorrect.' }
  if (!account.verified) return { ok: false, error: 'Please verify your account before signing in.' }
  const user = publicUser(account)
  saveSession(user)
  return { ok: true, user }
}

export function verifyAccount(identifierInput: string): AuthResult {
  const identifier = identifierInput.trim().toLowerCase()
  const accounts = getAccounts()
  const index = accounts.findIndex(item => item.identifier.toLowerCase() === identifier)
  if (index < 0) return { ok: false, error: 'We could not find that account.' }
  accounts[index] = { ...accounts[index], verified: true }
  setAccounts(accounts)
  const user = publicUser(accounts[index])
  saveSession(user)
  return { ok: true, user }
}

export function resetPassword(identifierInput: string, password: string): AuthResult {
  const identifier = identifierInput.trim().toLowerCase()
  const issue = passwordIssue(password)
  if (issue) return { ok: false, error: issue }
  const accounts = getAccounts()
  const index = accounts.findIndex(item => item.identifier.toLowerCase() === identifier)
  if (index < 0) return { ok: false, error: 'We could not find an account for that identifier.' }
  accounts[index] = { ...accounts[index], password }
  setAccounts(accounts)
  return { ok: true, user: publicUser(accounts[index]) }
}

export function saveSession(user: AuthUser, token?: string) { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token, expiresAt: Date.now() + SESSION_DURATION })) }
export function getSessionToken() {
  try { return (JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { token?: string } | null)?.token ?? null } catch { return null }
}

export function getSession(): AuthUser | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { user: AuthUser & { email?: string }; expiresAt: number } | null
    if (!session || session.expiresAt < Date.now()) { localStorage.removeItem(SESSION_KEY); return null }
    const role = normalizeRole(session.user.role)
    return { id: session.user.id, name: session.user.name, identifier: session.user.identifier ?? session.user.email ?? '', identifierType: identifierTypeFor(role), lecturerEmail: session.user.lecturerEmail, role, profile: session.user.profile, verified: session.user.verified }
  } catch { localStorage.removeItem(SESSION_KEY); return null }
}

export function logout() { localStorage.removeItem(SESSION_KEY) }
export function deleteAccount(user: AuthUser) { setAccounts(getAccounts().filter(account => account.id !== user.id)); logout() }
