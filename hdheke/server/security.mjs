import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return 'scrypt$' + salt + '$' + Buffer.from(derived).toString('hex')
}

export async function matchesPassword(password, storedHash) {
  const [algorithm, salt, hash] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !hash) return false
  const derived = Buffer.from(await scrypt(password, salt, 64))
  const expected = Buffer.from(hash, 'hex')
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

export const createVerificationCode = () => String(randomInt(100000, 1_000_000))
export const hashValue = value => createHash('sha256').update(value).digest('hex')
export const createSessionToken = () => randomBytes(48).toString('base64url')
