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
