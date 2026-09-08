import { createHash } from 'node:crypto'
import { Contract, JsonRpcProvider, Wallet } from 'ethers'
import { config } from '../config.js'
import { getDb } from '../db.js'

const registryAbi = [
  'function registerFingerprint(bytes32 fingerprint)',
  'function fingerprintOwners(bytes32) view returns (address)',
  'function registeredAt(bytes32) view returns (uint256)',
]

export type RegistrationResult = {
  transactionHash: string
  network: 'polygon' | 'local'
}

export type VerificationResult = {
  verified: boolean
  network: 'polygon' | 'local'
  transactionHash?: string
  registeredAt?: string
}

export async function registerFingerprint(fingerprint: string, userId: string): Promise<RegistrationResult> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('Fingerprint must be a SHA-256 hexadecimal hash.')
  }

  if (config.polygonRpcUrl && config.polygonPrivateKey && config.polygonContractAddress) {
    const provider = new JsonRpcProvider(config.polygonRpcUrl)
    const wallet = new Wallet(config.polygonPrivateKey, provider)
    const contract = new Contract(config.polygonContractAddress, registryAbi, wallet)
    const transaction = await contract.registerFingerprint(`0x${fingerprint}`)
    await transaction.wait()
    return { transactionHash: transaction.hash, network: 'polygon' }
  }

  const database = await getDb()
  const transactionHash = `0x${createHash('sha256')
    .update(`${userId}:${fingerprint}:${Date.now()}`)
    .digest('hex')}`
  await database.query(
    `INSERT INTO blockchain_registrations (user_id, fingerprint_hash, transaction_hash, network)
     VALUES ($1, $2, $3, 'local')`,
    [userId, fingerprint, transactionHash],
  )
  return { transactionHash, network: 'local' }
}

export async function verifyFingerprint(fingerprint: string, userId: string): Promise<VerificationResult> {
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error('Fingerprint must be a SHA-256 hexadecimal hash.')
  }

  if (config.polygonRpcUrl && config.polygonContractAddress) {
    const provider = new JsonRpcProvider(config.polygonRpcUrl)
    const contract = new Contract(config.polygonContractAddress, registryAbi, provider)
    const owner = await contract.fingerprintOwners(`0x${fingerprint}`)
    const registeredAt = await contract.registeredAt(`0x${fingerprint}`)
    return {
      verified: owner !== '0x0000000000000000000000000000000000000000',
      network: 'polygon',
      registeredAt: registeredAt > 0n ? new Date(Number(registeredAt) * 1000).toISOString() : undefined,
    }
  }

  const database = await getDb()
  const result = await database.query<{ transaction_hash: string; created_at: string }>(
    `SELECT transaction_hash, created_at
     FROM blockchain_registrations
     WHERE user_id = $1 AND fingerprint_hash = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, fingerprint],
  )
  const registration = result.rows[0]
  return {
    verified: Boolean(registration),
    network: 'local',
    transactionHash: registration?.transaction_hash,
    registeredAt: registration?.created_at,
  }
}

export async function getFingerprintAuditLog(userId: string) {
  const database = await getDb()
  const result = await database.query<{
    fingerprint_hash: string
    transaction_hash: string
    network: 'polygon' | 'local'
    created_at: string
  }>(
    `SELECT fingerprint_hash, transaction_hash, network, created_at
     FROM blockchain_registrations
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  )
  return result.rows
}
