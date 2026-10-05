import { test, expect } from '@playwright/test'
import { loginMatControlUser } from './helpers/matControlFixtures'
import { runMatControlLiveFlow, runMatControlTieBreakLiveFlow } from './helpers/matControlLiveApi'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('mat control full live flow', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('runs TC/CC flow through real control API', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const result = await runMatControlLiveFlow(page.request, 1)
    test.skip(!result.ok, result.ok ? '' : result.reason)

    expect(result.boutId).toBeTruthy()
    expect(result.hasQueueAfterConfirm).toBe(true)
    expect(result.hasRecentBout).toBe(true)
  })

  test('runs tie-break extra activity flow through real control API', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const result = await runMatControlTieBreakLiveFlow(page.request, 1)
    test.skip(!result.ok, result.ok ? '' : result.reason)

    expect(result.boutId).toBeTruthy()
    expect(result.hasRecentBout).toBe(true)
    expect(result.hasQueueAfterConfirm).toBe(true)
  })

  test('plan E2E: tie-break API flow confirms result and exposes next bout', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const result = await runMatControlTieBreakLiveFlow(page.request, 1)
    test.skip(!result.ok, result.ok ? '' : result.reason)

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByRole('heading', { name: 'Рабочее место ковра 1' })).toBeVisible()
    await expect(page.getByText('Недавние поединки')).toBeVisible()
    if (result.hasQueueAfterConfirm) {
      await expect(
        page
          .getByRole('button', { name: 'Перейти к следующему поединку' })
          .or(page.getByRole('button', { name: '1-й вызов красного' }))
          .or(page.getByText('Следующий в очереди')),
      ).toBeVisible()
    }
  })

  test('UI reflects confirmed bout and next queue after live API flow', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)

    const result = await runMatControlLiveFlow(page.request, 1)
    test.skip(!result.ok, result.ok ? '' : result.reason)

    await page.goto('/admin/bouts/mats/1/control')
    await expect(page.getByRole('heading', { name: 'Рабочее место ковра 1' })).toBeVisible()
    await expect(page.getByText('Недавние поединки')).toBeVisible()
    if (result.hasQueueAfterConfirm) {
      await expect(
        page
          .getByRole('button', { name: 'Перейти к следующему поединку' })
          .or(page.getByRole('button', { name: '1-й вызов красного' }))
          .or(page.getByText('Следующий в очереди')),
      ).toBeVisible()
    }
  })
})
