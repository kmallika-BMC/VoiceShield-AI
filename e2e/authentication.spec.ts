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

  await page.getByRole('link', { name: 'Profile' }).click()
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
})
