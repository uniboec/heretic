import type { Page } from '@playwright/test'
import { loginAdminPage } from './adminAuth'
import { TOURNAMENT_TIMEZONE } from '../../../lib/config/tournament'
import tournamentStateOpen from '../fixtures/tournament-state-open.json'
import tournamentStateClosed from '../fixtures/tournament-state-closed.json'
import tournamentParticipants from '../fixtures/tournament-participants.json'
import tournamentClubs from '../fixtures/tournament-clubs.json'
import tournamentBrackets from '../fixtures/tournament-brackets.json'
import adminStats from '../fixtures/admin-stats.json'
import adminResponses from '../fixtures/admin-responses.json'
import adminRegistrationsKpi from '../fixtures/admin-registrations-kpi.json'
import adminRegistrations from '../fixtures/admin-registrations.json'
import adminRegistrationDetail from '../fixtures/admin-registration-detail.json'
import adminBracketsDashboard from '../fixtures/admin-brackets-dashboard.json'
import adminBracketsCategoryStructure from '../fixtures/admin-brackets-category-structure.json'
import adminBoutsSettings from '../fixtures/admin-bouts-settings.json'
import adminBoutsDashboard from '../fixtures/admin-bouts-dashboard.json'

/** Fixed instant during regular registration (2026-09-23 12:00 in Asia/Yekaterinburg). */
export const VISUAL_FIXED_TIME = new Date('2026-09-23T07:00:00.000Z')

export const VISUAL_TIMEZONE = TOURNAMENT_TIMEZONE

export type VisualRegistrationMode = 'open' | 'closed'

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

export async function installVisualMocks(
  page: Page,
  options: { registrationMode?: VisualRegistrationMode } = {},
) {
  const registrationMode = options.registrationMode ?? 'open'
  const tournamentState =
    registrationMode === 'closed' ? tournamentStateClosed : tournamentStateOpen

  await page.clock.install({ time: VISUAL_FIXED_TIME })

  await page.route('**/api/tournament/state', (route) => route.fulfill(jsonRoute(tournamentState)))
  await page.route('**/api/tournament/participants**', (route) =>
    route.fulfill(jsonRoute(tournamentParticipants)),
  )
  await page.route('**/api/tournament/clubs**', (route) => route.fulfill(jsonRoute(tournamentClubs)))
  await page.route('**/api/tournament/brackets', (route) =>
    route.fulfill(jsonRoute(tournamentBrackets)),
  )

  await page.route('**/api/registrations', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            'Укажите название клуба или выберите клуб из списка',
            'Укажите телефон тренера',
            'Добавьте хотя бы одного спортсмена с заполненными данными',
          ],
        }),
      })
    }
    return route.continue()
  })
}

export async function installAdminVisualMocks(page: Page) {
  await page.route('**/api/admin/stats', (route) => route.fulfill(jsonRoute(adminStats)))
  await page.route('**/api/admin/responses**', (route) => route.fulfill(jsonRoute(adminResponses)))
  await page.route('**/api/admin/registrations/*', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    const url = route.request().url()
    if (url.includes('/reg-visual-001')) {
      return route.fulfill(jsonRoute(adminRegistrationDetail))
    }
    return route.continue()
  })
  await page.route('**/api/admin/registrations', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    const url = route.request().url()
    if (url.includes('/export') || url.includes('/kpi')) {
      return route.continue()
    }
    return route.fulfill(jsonRoute(adminRegistrations))
  })
  await page.route('**/api/admin/registrations/kpi', (route) =>
    route.fulfill(jsonRoute(adminRegistrationsKpi)),
  )
  await page.route('**/api/admin/brackets/categories/**/structure', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    return route.fulfill(jsonRoute(adminBracketsCategoryStructure))
  })
  await page.route('**/api/admin/brackets', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    return route.fulfill(jsonRoute(adminBracketsDashboard))
  })
  await page.route('**/api/admin/bouts/settings', (route) =>
    route.fulfill(jsonRoute(adminBoutsSettings)),
  )
  await page.route('**/api/admin/bouts', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    const url = route.request().url()
    if (url.includes('/settings') || url.includes('/executions') || url.includes('/mats/')) {
      return route.continue()
    }
    return route.fulfill(jsonRoute(adminBoutsDashboard))
  })
}

export async function loginAdminForVisual(page: Page) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    throw new Error('ADMIN_SESSION_SECRET is required for admin visual tests (see .env)')
  }

  const ok = await loginAdminPage(page)
  if (!ok) {
    throw new Error('Admin login failed (set E2E_ADMIN_PASSWORD or run set-admin-password)')
  }
}

export async function waitForPublicShell(page: Page) {
  await page.locator('.event-header').waitFor({ state: 'visible' })
}

/** Waits for client-side tournament state (stats, countdown) before home page screenshots. */
export async function waitForHomePageReady(
  page: Page,
  options: { registrationOpen?: boolean } = {},
) {
  const registrationOpen = options.registrationOpen ?? true
  await waitForPublicShell(page)
  await page.locator('.event-participants-teaser-stats').waitFor({ state: 'visible' })
  if (registrationOpen) {
    await page.locator('.event-countdown-plaque').waitFor({ state: 'visible' })
  }
}

export async function waitForAdminShell(page: Page) {
  await page.locator('.admin-header').waitFor({ state: 'visible' })
}

async function waitForStablePageHeight(
  page: Page,
  options: { timeout?: number; stableMs?: number } = {},
) {
  const timeout = options.timeout ?? 15_000
  const stableMs = options.stableMs ?? 500
  const start = Date.now()
  let lastHeight = -1
  let stableSince = Date.now()

  while (Date.now() - start < timeout) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    if (height === lastHeight) {
      if (Date.now() - stableSince >= stableMs) return
    } else {
      lastHeight = height
      stableSince = Date.now()
    }
    await page.waitForTimeout(100)
  }

  throw new Error(`Page height did not stabilize within ${timeout}ms (last: ${lastHeight}px)`)
}

/** Waits for bracket structure preview before admin brackets screenshots. */
export async function waitForAdminBracketsReady(page: Page) {
  await waitForAdminShell(page)
  await page
    .getByRole('heading', { level: 2, name: '12–13 лет, 52–55 кг, новички' })
    .waitFor({ state: 'visible' })
  await page.getByText('Загрузка сетки…').waitFor({ state: 'hidden' })
  await page
    .locator('.bracket-match')
    .first()
    .or(page.getByText('Участник категории'))
    .or(page.getByText('Победитель категории'))
    .waitFor({ state: 'visible' })
  await page.waitForLoadState('networkidle')
  await waitForStablePageHeight(page, { stableMs: 1200, timeout: 25_000 })
}
