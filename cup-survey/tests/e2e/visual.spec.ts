import { test, expect } from '@playwright/test'
import {
  installAdminVisualMocks,
  installVisualMocks,
  loginAdminForVisual,
  waitForAdminBracketsReady,
  waitForAdminShell,
  waitForHomePageReady,
  waitForPublicShell,
} from './helpers/visualFixtures'

test.describe('visual regression @visual', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Visual baselines are generated for Chromium only')
  })

  test.describe('public — tournament hero', () => {
    test('home registration open @375', async ({ page }) => {
      await installVisualMocks(page, { registrationMode: 'open' })
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/')
      await waitForHomePageReady(page, { registrationOpen: true })
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Кубок Свердловской области')
      await expect(page).toHaveScreenshot('home-open-375.png', { fullPage: true })
    })

    test('home registration open @1024', async ({ page }) => {
      await installVisualMocks(page, { registrationMode: 'open' })
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/')
      await waitForHomePageReady(page, { registrationOpen: true })
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Кубок Свердловской области')
      await expect(page).toHaveScreenshot('home-open-1024.png', { fullPage: true })
    })

    test('home registration closed @375', async ({ page }) => {
      await installVisualMocks(page, { registrationMode: 'closed' })
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/')
      await waitForHomePageReady(page, { registrationOpen: false })
      await expect(page.locator('.event-hero').getByRole('button', { name: 'Регистрация закрыта' })).toBeDisabled()
      await expect(page).toHaveScreenshot('home-closed-375.png', { fullPage: true })
    })

    test('home registration closed @1024', async ({ page }) => {
      await installVisualMocks(page, { registrationMode: 'closed' })
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/')
      await waitForHomePageReady(page, { registrationOpen: false })
      await expect(page.locator('.event-hero').getByRole('button', { name: 'Регистрация закрыта' })).toBeDisabled()
      await expect(page).toHaveScreenshot('home-closed-1024.png', { fullPage: true })
    })
  })

  test.describe('public — DNA primitives on home', () => {
    test('hero CTA buttons @1024', async ({ page }) => {
      await installVisualMocks(page, { registrationMode: 'open' })
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/')
      await waitForHomePageReady(page, { registrationOpen: true })
      const hero = page.locator('.event-hero')
      await expect(hero.getByRole('link', { name: 'Зарегистрироваться' })).toBeVisible()
      await expect(hero).toHaveScreenshot('home-hero-cta-1024.png')
    })
  })

  test.describe('public — registration', () => {
    test('empty form @375', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/registratsiya')
      await waitForPublicShell(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Регистрация на соревнование' })).toBeVisible()
      await expect(page).toHaveScreenshot('registration-empty-375.png', { fullPage: true })
    })

    test('empty form @1024', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/registratsiya')
      await waitForPublicShell(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Регистрация на соревнование' })).toBeVisible()
      await expect(page).toHaveScreenshot('registration-empty-1024.png', { fullPage: true })
    })

    test('validation errors @375', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/registratsiya')
      await waitForPublicShell(page)
      await page.getByRole('region', { name: 'Итого по заявке' }).getByRole('button', { name: 'Отправить' }).click()
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
      await expect(page).toHaveScreenshot('registration-validation-375.png', { fullPage: true })
    })

    test('validation errors @1024', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/registratsiya')
      await waitForPublicShell(page)
      const submit = page.getByRole('main').getByRole('button', { name: 'Зарегистрироваться' })
      await submit.scrollIntoViewIfNeeded()
      await submit.click()
      await expect(page.getByRole('main').getByRole('alert')).toContainText('Укажите название клуба', {
        timeout: 15_000,
      })
      await expect(page).toHaveScreenshot('registration-validation-1024.png', { fullPage: true })
    })
  })

  test.describe('public — participants', () => {
    test('list with badges @375', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/athletes')
      await waitForPublicShell(page)
      await expect(page.locator('.event-participant-card-name').first()).toHaveText('Иванов Иван Сергеевич')
      await expect(page).toHaveScreenshot('participants-list-375.png', { fullPage: true })
    })

    test('list with badges @1024', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/athletes')
      await waitForPublicShell(page)
      await expect(page.locator('.event-table-name', { hasText: 'Иванов Иван Сергеевич' }).first()).toBeVisible()
      await expect(page).toHaveScreenshot('participants-list-1024.png', { fullPage: true })
    })

    test('filters open @375', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/athletes')
      await waitForPublicShell(page)
      await page.getByRole('button', { name: /фильтр/i }).click()
      await expect(page.locator('.event-participants-filters.is-open')).toBeVisible()
      await expect(page).toHaveScreenshot('participants-filters-375.png', { fullPage: true })
    })

    test('filters open @1024', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/athletes')
      await waitForPublicShell(page)
      await page.getByRole('button', { name: /фильтр/i }).click()
      await expect(page.locator('.event-participants-filters.is-open')).toBeVisible()
      await expect(page).toHaveScreenshot('participants-filters-1024.png', { fullPage: true })
    })
  })

  test.describe('public — brackets', () => {
    test('category selected @375', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/brackets')
      await waitForPublicShell(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Сетки' })).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 2, name: '12–13 лет, 52–55 кг, новички' }),
      ).toBeVisible()
      await expect(page).toHaveScreenshot('brackets-selected-375.png', { fullPage: true })
    })

    test('category selected @1024', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/brackets')
      await waitForPublicShell(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Сетки' })).toBeVisible()
      await expect(
        page.getByRole('heading', { level: 2, name: '12–13 лет, 52–55 кг, новички' }),
      ).toBeVisible()
      await expect(page).toHaveScreenshot('brackets-selected-1024.png', { fullPage: true })
    })

    test('print preview', async ({ page }) => {
      await installVisualMocks(page)
      await page.setViewportSize({ width: 1024, height: 900 })
      await page.goto('/brackets')
      await waitForPublicShell(page)
      await expect(
        page.getByRole('heading', { level: 2, name: '12–13 лет, 52–55 кг, новички' }),
      ).toBeVisible()
      await page.emulateMedia({ media: 'print' })
      await expect(page).toHaveScreenshot('brackets-print.png', { fullPage: true })
    })
  })

  test.describe('admin — login', () => {
    test('login form @768', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.goto('/admin/login')
      await expect(page.getByRole('heading', { name: 'Вход в админку' })).toBeVisible()
      await expect(page).toHaveScreenshot('admin-login-768.png', { fullPage: true })
    })
  })

  test.describe('admin — authenticated', () => {
    test.beforeEach(async ({ page }) => {
      await installVisualMocks(page)
      await installAdminVisualMocks(page)
      await loginAdminForVisual(page)
    })

    test('registrations table @1440', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/admin/registrations')
      await waitForAdminShell(page)
      await expect(page.getByRole('heading', { name: 'Регистрация турнира' })).toBeVisible()
      await expect(page.getByRole('cell', { name: 'Клуб «Универсальные бойцы»' })).toBeVisible()
      await expect(page).toHaveScreenshot('admin-registrations-1440.png', { fullPage: true })
    })

    test('brackets dashboard @1440', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/admin/brackets')
      await waitForAdminBracketsReady(page)
      await expect(page.locator('.admin-container')).toHaveScreenshot('admin-brackets-1440.png')
    })

    test('bouts dashboard @1440', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/admin/bouts')
      await waitForAdminShell(page)
      await expect(page.getByRole('heading', { name: 'Поединки' })).toBeVisible()
      await expect(page.getByText('Live-управление')).toBeVisible()
      await expect(page.getByText('Расписание поединков')).toBeVisible()
      await expect(page).toHaveScreenshot('admin-bouts-1440.png', { fullPage: true })
    })

    test('bouts dashboard @375', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 })
      await page.goto('/admin/bouts')
      await waitForAdminShell(page)
      await expect(page.getByRole('heading', { name: 'Поединки' })).toBeVisible()
      await expect(page).toHaveScreenshot('admin-bouts-375.png', { fullPage: true })
    })

    test('survey historical dashboard @1440', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/admin/survey')
      await waitForAdminShell(page)
      await expect(page.getByRole('heading', { name: 'Результаты опроса' })).toBeVisible()
      await expect(page.getByText('Всего ответов')).toBeVisible()
      await expect(page).toHaveScreenshot('admin-survey-1440.png', { fullPage: true })
    })

    test('registration detail modal @768', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.goto('/admin/registrations')
      await waitForAdminShell(page)
      await page.getByRole('button', { name: /Универсальные бойцы/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByText('Клуб «Универсальные бойцы»').first()).toBeVisible()
      await expect(page).toHaveScreenshot('modal-registration-detail-768.png', { fullPage: true })
    })

    test('payment proof modal @768', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.goto('/admin/registrations')
      await waitForAdminShell(page)
      await page.getByRole('button', { name: /Универсальные бойцы/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Проверить последнюю квитанцию' }).click()
      await expect(page.getByRole('dialog').nth(1)).toBeVisible()
      await expect(page).toHaveScreenshot('modal-payment-proof-768.png', { fullPage: true })
    })

    test('athlete edit modal @768', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.goto('/admin/registrations')
      await waitForAdminShell(page)
      await page.getByRole('button', { name: /Универсальные бойцы/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Редактировать' }).click()
      await expect(page.getByRole('dialog').nth(1)).toBeVisible()
      await expect(page).toHaveScreenshot('modal-athlete-edit-768.png', { fullPage: true })
    })
  })
})
