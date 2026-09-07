import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

/**
 * Creates a self-contained, salted scrypt password hash suitable for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, KEY_LENGTH) as Buffer

  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

/** Used by the forthcoming login endpoint without exposing plain-text passwords. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split('$')

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false
  }

  const expected = Buffer.from(hash, 'hex')
  const actual = await scrypt(password, salt, expected.length) as Buffer

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
