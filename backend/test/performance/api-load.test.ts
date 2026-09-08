import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import type { AddressInfo } from 'node:net'
import { app } from '../../src/index.js'

let server: ReturnType<typeof app.listen>
let baseUrl = ''

before(async () => {
  server = app.listen(0)
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('protected API rejects concurrent unauthenticated requests within the local load target', async () => {
  const started = performance.now()
  const responses = await Promise.all(Array.from({ length: 50 }, () => fetch(`${baseUrl}/api/dashboard`)))
  const elapsed = performance.now() - started
  assert.ok(responses.every((response) => response.status === 401))
  assert.ok(elapsed < 5000, `concurrent health requests took ${Math.round(elapsed)}ms`)
})
