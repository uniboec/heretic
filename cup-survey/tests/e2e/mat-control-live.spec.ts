import { test, expect } from '@playwright/test'
import { loginMatControlUser } from './helpers/matControlFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('mat control live API', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('admin can load mat control snapshot from real API', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const response = await page.request.get('/api/admin/bouts/mats/1/control')
    expect(response.ok()).toBeTruthy()

    const snapshot = await response.json()
    expect(snapshot).toHaveProperty('session')
    expect(snapshot).toHaveProperty('queue')
    expect(snapshot).toHaveProperty('recentBouts')
  })

  test('public scoreboard API returns mat payload', async ({ request }) => {
    const response = await request.get('/api/scoreboard/1')
    expect([200, 404]).toContain(response.status())
    if (response.status() === 200) {
      const json = await response.json()
      expect(json).toHaveProperty('matIndex', 1)
    }
  })
})
