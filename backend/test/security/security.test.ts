import assert from 'node:assert/strict'
import { test } from 'node:test'
import { app } from '../../src/index.js'

test('protected resources reject missing credentials', async () => {
  const server = app.listen(0)
  try {
    const address = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${address.port}/api/dashboard`)
    assert.equal(response.status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})

test('oversized JSON payloads are rejected', async () => {
  const server = app.listen(0)
  try {
    const address = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.test', password: 'x'.repeat(1_100_000) }),
    })
    assert.equal(response.status, 413)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
