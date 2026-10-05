import { test, expect } from '@playwright/test'
import adminBoutsDashboard from './fixtures/admin-bouts-dashboard.json'
import {
  installAdminVisualMocks,
  loginAdminForVisual,
  waitForAdminShell,
} from './helpers/visualFixtures'

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function openBoutsSettings(page: import('@playwright/test').Page) {
  await installAdminVisualMocks(page)
  await loginAdminForVisual(page)

  await page.route('**/api/admin/bouts/settings', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      return route.fulfill(
        jsonRoute({
          settings: {
            publicEnabled: true,
            matCount: 2,
            autoMatAssignMode: body.autoMatAssignMode ?? 'BY_CATEGORY',
            autoMatByCategoryEnabled: false,
          },
        }),
      )
    }
    return route.continue()
  })

  await page.goto('/admin/bouts')
  await waitForAdminShell(page)
  await expect(page.getByText('Настройки расписания', { exact: true })).toBeVisible()
}

test.describe('admin bouts settings UX', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('shows redesigned settings sections and terminology', async ({ page }) => {
    await openBoutsSettings(page)

    await expect(page.getByRole('heading', { name: 'Основное' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Время и паузы' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Распределение по коврам' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Правила проведения' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Основное' }).getByText('Ковров')).toBeVisible()
    await expect(page.getByLabel('Пауза между поединками')).toBeVisible()
    await expect(page.getByText('Поединки по коврам')).toBeVisible()
    await expect(page.getByText('Доступно распределение только отдельных поединков.')).toBeVisible()
    await expect(page.getByText('Auto-категории')).toHaveCount(0)
  })

  test('disables timing save for invalid draft', async ({ page }) => {
    await openBoutsSettings(page)

    const breakInput = page.getByLabel('Пауза между поединками')
    await breakInput.fill('99')
    await expect(page.getByText('Изменено')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить' }).first()).toBeDisabled()
    await expect(page.getByText(/От 0 до 30 мин/)).toBeVisible()
  })

  test('keeps dirty timing draft after unrelated immediate toggle', async ({ page }) => {
    await openBoutsSettings(page)

    const breakInput = page.getByLabel('Пауза между поединками')
    await breakInput.fill('5')
    await expect(page.getByText('Изменено')).toBeVisible()

    await page.getByRole('button', { name: 'По времени' }).first().click()
    await expect(page.getByText('Изменено')).toBeVisible()
    await expect(breakInput).toHaveValue('5')
    await expect(page.getByText('Настройки сохранены')).toHaveCount(0)
  })

  test('keeps advanced draft open after unrelated refetch', async ({ page }) => {
    await openBoutsSettings(page)

    await page.getByText('Дополнительные настройки').click()
    const durationSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Длительность поединков' }),
    })
    const durationInput = durationSection.getByRole('spinbutton').first()
    await durationInput.fill('4')
    await expect(page.locator('details[open]')).toBeVisible()

    await page.getByRole('checkbox', { name: 'Финалы в конце ковра' }).click()

    await expect(page.locator('details[open]')).toBeVisible()
    await expect(durationInput).toHaveValue('4')
    await expect(page.getByText('Изменено')).toBeVisible()
  })
})
