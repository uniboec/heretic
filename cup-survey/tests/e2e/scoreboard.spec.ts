import { test, expect } from '@playwright/test'
import { loginMatControlUser } from './helpers/matControlFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('public scoreboard', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('renders mat scoreboard page', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    await page.goto('/scoreboard/1')

    await expect(page.getByRole('heading', { name: 'Ковёр 1' })).toBeVisible()
    await expect(page.getByText('Табло ковра')).toBeVisible()
  })
})
