import { test, expect } from '@playwright/test'
import {
  buildClearAdvantageSnapshot,
  buildMatControlSnapshot,
  installLeaseLossMocks,
  installMatControlMocks,
  installStatefulMatControlFlowMocks,
  loginMatControlUser,
} from './helpers/matControlFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

test.describe('mat control workspace', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('shows prep controls in scheduled phase', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Ковёр 1')).toBeVisible()
    await expect(page.getByTestId('judge-fight-button')).toBeVisible()
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('Петров Пётр')).toBeVisible()
  })

  test('shows next bout ready when queue has no active bout', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'scheduled', queueOnly: true }),
    )

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Следующий поединок готов')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Начать поединок' })).toBeVisible()
  })

  test('shows queue strip on live bout', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(page, buildMatControlSnapshot({ boutPhase: 'live', queueOnly: false }))

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Очередь пуста')).toBeVisible()
  })

  test('admin sees result correction on confirmed bout', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'confirmed', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByRole('button', { name: 'Изменить результат' })).toBeVisible()
  })

  test('runs tie-break flow through extra period and activity decision', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installStatefulMatControlFlowMocks(page)

    await page.goto('/admin/bouts/mats/1/control')

    await page.getByTestId('judge-fight-button').click()
    await expect(page.getByRole('button', { name: 'Плюс 2' }).first()).toBeEnabled()

    const scoreTwo = page.getByRole('button', { name: 'Плюс 2' })
    await scoreTwo.nth(0).click()
    await scoreTwo.nth(1).click()
    await expect(page.getByText('Доп. раунд')).toBeVisible({ timeout: 15_000 })
    await expect(scoreTwo.first()).toBeEnabled()
    await scoreTwo.nth(0).click()
    await scoreTwo.nth(1).click()
    await expect(page.getByText('Активность в доп. раунде')).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Красный активнее' }).click()

    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
    await page.getByRole('button', { name: 'Подтвердить результат' }).click()
    await expect(page.getByText('Поединок завершён')).toBeVisible()
  })

  test('plan UI flow: tie-break confirm advances to next bout in queue', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installStatefulMatControlFlowMocks(page)

    await page.goto('/admin/bouts/mats/1/control')

    await page.getByTestId('judge-fight-button').click()
    await expect(page.getByRole('button', { name: 'Плюс 2' }).first()).toBeEnabled()
    const scoreTwo = page.getByRole('button', { name: 'Плюс 2' })
    await scoreTwo.nth(0).click()
    await scoreTwo.nth(1).click()
    await expect(page.getByText('Доп. раунд')).toBeVisible({ timeout: 15_000 })
    await scoreTwo.nth(0).click()
    await scoreTwo.nth(1).click()
    await page.getByRole('button', { name: 'Красный активнее' }).click()
    await page.getByRole('button', { name: 'Подтвердить результат' }).click()

    await expect(page.getByText('Поединок завершён')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Перейти к следующему поединку' })).toBeVisible()
    await page.getByRole('button', { name: 'Перейти к следующему поединку' }).click()
    await expect(page.getByText('Следующий поединок готов')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Начать поединок' })).toBeVisible()
    await expect(page.getByText('Иванов Иван')).toBeVisible()
  })

  test('shows clear advantage banner when score difference is 10+', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(page, buildClearAdvantageSnapshot())

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Я.П. · разница 10')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Завершить по Я.П.' })).toBeVisible()
  })

  test('auto-takeovers when lease is occupied by another session', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installLeaseLossMocks(page)

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Управление')).toBeVisible()
    await expect(page.getByText('Ковёр занят')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Начать поединок' })).toBeVisible()
  })

  test('runs TC/CC flow through pre-fight, live scoring, and confirmation', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'admin')), LOGIN_SKIP_MESSAGE)
    await installStatefulMatControlFlowMocks(page)

    await page.goto('/admin/bouts/mats/1/control')

    await page.getByTestId('judge-fight-button').click()
    const plusFour = page.getByRole('button', { name: 'Плюс 4' }).first()
    await expect(plusFour).toBeEnabled()
    await plusFour.click()
    const finishBout = page.getByRole('button', { name: 'Завершить поединок →' })
    await expect(finishBout).toBeEnabled()
    await finishBout.click()
    await page.getByRole('button', { name: 'Болевой приём' }).click()
    await page.getByRole('button', { name: 'Красный — Иванов Иван' }).click()
    await page.getByRole('button', { name: 'На руку' }).click()
    await page.getByRole('button', { name: 'Подтвердить остановку' }).click()
    await expect(page.getByRole('button', { name: 'Подтвердить результат' })).toBeVisible()
    await page.getByRole('button', { name: 'Подтвердить результат' }).click()
    await expect(page.getByText('Поединок завершён')).toBeVisible()
  })

  test('operator cannot access correction preview API', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'mat_operator')), LOGIN_SKIP_MESSAGE)

    const response = await page.request.get(
      '/api/admin/bouts/cat-a::bout-1/result-correction/preview?newWinnerEntryId=red-1&systemId=olympic&categoryKey=cat-a',
    )
    expect(response.status()).toBe(401)
  })

  test('mat operator cannot correct confirmed result', async ({ page }) => {
    test.skip(!(await loginMatControlUser(page, 'mat_operator')), LOGIN_SKIP_MESSAGE)
    await installMatControlMocks(
      page,
      buildMatControlSnapshot({ boutPhase: 'confirmed', role: 'mat_operator', queueOnly: false }),
    )

    await page.goto('/admin/bouts/mats/1/control')

    await expect(page.getByText('Поединок завершён')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Изменить результат' })).toHaveCount(0)
  })
})
