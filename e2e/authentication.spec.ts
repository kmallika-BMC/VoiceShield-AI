import { expect, test } from '@playwright/test'

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@voiceshield.test`
}

test('home page presents the VoiceShield platform and registration entry point', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('VoiceShield AI')
  await expect(
    page.getByRole('heading', { name: 'Detect and prevent AI voice cloning attacks in real time.' }),
  ).toBeVisible()
  await expect(page.getByText('Real-time detection')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Register' }).first()).toHaveAttribute(
    'href',
    '/register',
  )
})

test('user can register and receives a success confirmation', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')

  await page.getByLabel('Name').fill('E2E Test User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()
  await expect(page.getByLabel('Name')).toHaveValue('')
  await expect(page.getByLabel('Email')).toHaveValue('')
  await expect(page.getByLabel('Password')).toHaveValue('')
})

test('duplicate registration is rejected with a clear error', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')

  await page.getByLabel('Name').fill('First E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()

  await page.getByLabel('Name').fill('Duplicate E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('another-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('An account with this email already exists.')).toBeVisible()
})

test('invalid login credentials are rejected', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await page.getByLabel('Email').fill('unknown@voiceshield.test')
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Invalid email or password.')).toBeVisible()
})

test('protected dashboard rejects unauthenticated users', async ({ page }) => {
  await page.goto('/dashboard')

  await expect(page.getByText('Authentication required.')).toBeVisible()
})

test('valid login grants access to the protected dashboard', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Name').fill('Dashboard E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText(email)).toBeVisible()
})

test('dashboard sidebar navigates between protected sections', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('voiceshield_access_token', 'invalid-token')
  })
  await page.goto('/dashboard')

  await expect(page.getByRole('navigation', { name: 'Dashboard navigation' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard')
  await expect(page.getByRole('link', { name: 'Voice analysis' })).toHaveAttribute(
    'href',
    '/dashboard/analysis',
  )
  await page.getByRole('link', { name: 'Voice analysis' }).click()

  await expect(page).toHaveURL(/\/dashboard\/analysis$/)
  await expect(page.getByRole('heading', { name: 'Voice analysis' })).toBeVisible()
  await expect(page.getByText('Analyze live audio and recordings')).toBeVisible()
})

test('dashboard displays statistics and risk trend visualizations', async ({ page }) => {
  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { user_id: 'stats-user', name: 'Stats User', email: 'stats@example.com' } }),
    })
  })
  await page.route('**/api/detection/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 5,
        classifications: { Genuine: 2, Suspicious: 1, 'AI Generated': 2 },
        riskTrend: [{ day: '2026-09-08', averageRisk: 72, detections: 2 }],
      }),
    })
  })
  await page.addInitScript(() => localStorage.setItem('voiceshield_access_token', 'test-token'))
  await page.goto('/dashboard')

  await expect(page.getByText('Total samples analyzed')).toBeVisible()
  await expect(page.getByText('Genuine vs suspicious results')).toBeVisible()
  await expect(page.getByText('Risk trend')).toBeVisible()
  await expect(page.getByText('72%')).toBeVisible()

  await page.getByRole('navigation', { name: 'Dashboard navigation' }).getByRole('link', { name: 'Statistics' }).click()
  await expect(page).toHaveURL(/\/dashboard\/stats$/)
  await expect(page.getByText('Attack events')).toBeVisible()
  await expect(page.getByText('Attack frequency by classification')).toBeVisible()
})

test('history page exposes prediction and date filters', async ({ page }) => {
  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { user_id: 'history-user', name: 'History User', email: 'history@example.com' } }),
    })
  })
  await page.route('**/api/detection/history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [], totalPages: 1, total: 0 }),
    })
  })
  await page.addInitScript(() => localStorage.setItem('voiceshield_access_token', 'test-token'))
  await page.goto('/dashboard/history')

  await expect(page.getByRole('heading', { name: 'Detection history' }).last()).toBeVisible()
  await expect(page.getByLabel('Prediction')).toHaveValue('All')
  await expect(page.getByLabel('From date')).toBeVisible()
  await expect(page.getByLabel('To date')).toBeVisible()
  await page.getByLabel('Prediction').selectOption('Suspicious')
  await page.getByLabel('From date').fill('2026-09-01')
  await page.getByLabel('To date').fill('2026-09-08')
  await expect(page.getByLabel('Prediction')).toHaveValue('Suspicious')
})

test('user can update profile name and see the persisted value', async ({ page }) => {
  const email = uniqueEmail()
  await page.goto('/register')
  await page.getByLabel('Name').fill('Profile E2E User')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText(`Account created for ${email}.`)).toBeVisible()

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('secure-password-123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('link', { name: 'Profile', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/profile$/)
  await page.getByLabel('Display name').fill('Updated Profile Name')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Profile updated successfully.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Display name')).toHaveValue('Updated Profile Name')
})

test('voice enrollment requires between 3 and 5 samples', async ({ page }) => {
  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { user_id: 'test', name: 'Voice User', email: 'voice@example.com' } }) })
  })
  await page.addInitScript(() => {
    localStorage.setItem('voiceshield_access_token', 'test-token')
  })
  await page.goto('/dashboard/analysis')
  await expect(page.getByRole('heading', { name: 'Voice analysis' })).toBeVisible()
  await expect(page.getByText('Record samples or choose WAV, MP3, and M4A files.')).toBeVisible()
})

test('voice samples are stored and assigned an enrollment fingerprint', async ({ request }) => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  const registration = await request.post('http://localhost:5000/api/auth/register', {
    data: { name: 'Voice API User', email, password },
  })

  expect(registration.ok()).toBeTruthy()

  const login = await request.post('http://localhost:5000/api/auth/login', {
    data: { email, password },
  })
  const loginBody = (await login.json()) as { token: string }
  const form = new FormData()
  form.append('samples', new Blob(['sample-one'], { type: 'audio/wav' }), 'one.wav')
  form.append('samples', new Blob(['sample-two'], { type: 'audio/wav' }), 'two.wav')
  form.append('samples', new Blob(['sample-three'], { type: 'audio/wav' }), 'three.wav')
  const upload = await fetch('http://localhost:5000/api/voice/samples', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
    body: form,
  })
  const body = (await upload.json()) as { samples?: unknown[]; fingerprint?: string }

  expect(upload.status).toBe(201)
  expect(body.samples).toHaveLength(3)
  expect(body.fingerprint).toMatch(/^[a-f0-9]{64}$/)
})

test('voice fingerprint can be registered on the local blockchain ledger', async () => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Blockchain API User', email, password }),
  })
  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = (await login.json()) as { token: string }
  const fingerprint = 'a'.repeat(64)
  const response = await fetch('http://localhost:5000/api/voice/fingerprint/register', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${loginBody.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fingerprint }),
  })
  const body = (await response.json()) as { transactionHash?: string; network?: string }

  expect(response.status).toBe(201)
  expect(body.network).toBe('local')
  expect(body.transactionHash).toMatch(/^0x[a-f0-9]{64}$/)
})

test('voice fingerprint verification and audit log expose registration status', async () => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Verification API User', email, password }),
  })
  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = (await login.json()) as { token: string }
  const headers = {
    Authorization: `Bearer ${loginBody.token}`,
    'Content-Type': 'application/json',
  }
  const fingerprint = 'b'.repeat(64)
  const registration = await fetch('http://localhost:5000/api/voice/fingerprint/register', {
    method: 'POST',
    headers,
    body: JSON.stringify({ fingerprint }),
  })
  expect(registration.status).toBe(201)

  const verification = await fetch('http://localhost:5000/api/voice/fingerprint/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ fingerprint }),
  })
  const verificationBody = (await verification.json()) as { verified?: boolean; network?: string }
  expect(verification.status).toBe(200)
  expect(verificationBody.verified).toBe(true)
  expect(verificationBody.network).toBe('local')

  const audit = await fetch('http://localhost:5000/api/voice/fingerprint/audit', {
    headers: { Authorization: headers.Authorization },
  })
  const auditBody = (await audit.json()) as { entries: Array<{ fingerprint_hash: string }> }
  expect(audit.status).toBe(200)
  expect(auditBody.entries.some((entry) => entry.fingerprint_hash === fingerprint)).toBe(true)
})

test('audio upload starts a protected processing job', async () => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  const registration = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Analysis API User', email, password }),
  })
  expect(registration.ok).toBeTruthy()
  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = (await login.json()) as { token: string }
  const form = new FormData()
  form.append('audio', new Blob(['audio-content'], { type: 'audio/wav' }), 'recording.wav')
  const upload = await fetch('http://localhost:5000/api/analysis/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
    body: form,
  })
  const body = (await upload.json()) as { job?: { status: string; original_name: string } }

  expect(upload.status).toBe(202)
  expect(body.job?.original_name).toBe('recording.wav')
  expect(body.job?.status).toBe('complete')
  expect(body.job?.mfcc).toHaveLength(13)
  expect(body.job?.spectrogram?.length).toBeGreaterThan(0)
})

test('audio detection returns a model prediction for an authenticated user', async () => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Detection API User', email, password }),
  })

  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = (await login.json()) as { token: string }
  const form = new FormData()
  form.append('audio', new Blob(['audio-content'], { type: 'audio/wav' }), 'detection.wav')
  const response = await fetch('http://localhost:5000/api/detection/predict', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
    body: form,
  })
  const body = (await response.json()) as {
    modelLoaded: boolean
    prediction: string
    classification: string
    confidenceScore: number
    riskScore: number
    reasons: string[]
  }

  expect(response.status).toBe(200)
  expect(body.modelLoaded).toBe(true)
  expect(['Genuine', 'Suspicious', 'AI Generated']).toContain(body.prediction)
  expect(body.classification).toBe(body.prediction)
  expect(body.confidenceScore).toBeGreaterThanOrEqual(0)
  expect(body.confidenceScore).toBeLessThanOrEqual(100)
  expect(body.riskScore).toBeGreaterThanOrEqual(0)
  expect(body.riskScore).toBeLessThanOrEqual(100)
  expect(body.reasons.length).toBeGreaterThan(0)

  const history = await fetch('http://localhost:5000/api/detection/history', {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  })
  const historyBody = (await history.json()) as {
    entries: Array<{ original_name: string; classification: string }>
    total: number
    totalPages: number
  }
  expect(history.status).toBe(200)
  expect(historyBody.total).toBeGreaterThan(0)
  expect(historyBody.totalPages).toBeGreaterThanOrEqual(1)
  expect(historyBody.entries.some((entry) => entry.original_name === 'detection.wav')).toBe(true)

  const filteredHistory = await fetch(
    'http://localhost:5000/api/detection/history?classification=Genuine&dateFrom=2020-01-01&dateTo=2099-12-31',
    { headers: { Authorization: 'Bearer ' + loginBody.token } },
  )
  const filteredBody = (await filteredHistory.json()) as {
    entries: Array<{ classification: string }>
  }
  expect(filteredHistory.status).toBe(200)
  expect(filteredBody.entries.every((entry) => entry.classification === 'Genuine')).toBe(true)

  const stats = await fetch('http://localhost:5000/api/detection/stats', {
    headers: { Authorization: 'Bearer ' + loginBody.token },
  })
  const statsBody = (await stats.json()) as {
    total: number
    classifications: Record<string, number>
    riskTrend: Array<{ averageRisk: number }>
  }
  expect(stats.status).toBe(200)
  expect(statsBody.total).toBeGreaterThanOrEqual(1)
  expect(statsBody.classifications[body.classification]).toBeGreaterThanOrEqual(1)
  expect(statsBody.riskTrend.length).toBeGreaterThan(0)
})

test('live audio chunks receive real-time inference results', async () => {
  const email = uniqueEmail()
  const password = 'secure-password-123'
  await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Live API User', email, password }),
  })
  const login = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginBody = (await login.json()) as { token: string }
  const form = new FormData()
  form.append('audio', new Blob(['live-audio-chunk'], { type: 'audio/webm' }), 'live-chunk.webm')
  const startedAt = Date.now()
  const response = await fetch('http://localhost:5000/api/detection/live', {
    method: 'POST',
    headers: { Authorization: `Bearer ${loginBody.token}` },
    body: form,
  })
  const body = (await response.json()) as {
    prediction?: string
    modelLoaded?: boolean
    confidenceScore?: number
    riskScore?: number
  }

  expect(response.status).toBe(200)
  expect(body.modelLoaded).toBe(true)
  expect(['Genuine', 'Suspicious', 'AI Generated']).toContain(body.prediction)
  expect(body.confidenceScore).toBeGreaterThanOrEqual(0)
  expect(body.riskScore).toBeGreaterThanOrEqual(0)
  expect(Date.now() - startedAt).toBeLessThan(3000)
})
