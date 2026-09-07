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

test('login route shows the current authentication placeholder', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
})
