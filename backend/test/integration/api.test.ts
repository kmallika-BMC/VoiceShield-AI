import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { app } from '../../src/index.js'

let server: ReturnType<typeof app.listen>
let baseUrl = ''
let token = ''

before(async () => {
  server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('authentication, AI detection, and local blockchain verification work together', async () => {
  const email = `integration-${Date.now()}@voiceshield.test`
  const password = 'secure-password-123'
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Integration User', email, password }),
  })
  assert.equal(registration.status, 201)

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(login.status, 200)
  token = (await login.json() as { token: string }).token
  assert.ok(token)

  const audio = new Blob([Buffer.from('integration audio sample')], { type: 'audio/wav' })
  const detectionBody = new FormData()
  detectionBody.append('audio', audio, 'integration.wav')
  const detection = await fetch(`${baseUrl}/api/detection/predict`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: detectionBody,
  })
  assert.equal(detection.status, 200)
  assert.equal((await detection.json() as { modelLoaded: boolean }).modelLoaded, true)

  const fingerprint = createHash('sha256').update('integration fingerprint').digest('hex')
  const registrationOnLedger = await fetch(`${baseUrl}/api/voice/fingerprint/register`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint }),
  })
  assert.equal(registrationOnLedger.status, 201)
  const verification = await fetch(`${baseUrl}/api/voice/fingerprint/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint }),
  })
  assert.equal(verification.status, 200)
  assert.equal((await verification.json() as { verified: boolean }).verified, true)
})
