import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(backendRoot, '.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  corsOrigin: required('CORS_ORIGIN'),
  databasePath: required('DATABASE_PATH'),
  jwtSecret: required('JWT_SECRET'),
  polygonRpcUrl: process.env.POLYGON_RPC_URL ?? '',
  polygonPrivateKey: process.env.POLYGON_PRIVATE_KEY ?? '',
  polygonContractAddress: process.env.POLYGON_CONTRACT_ADDRESS ?? '',
  backendRoot,
}
