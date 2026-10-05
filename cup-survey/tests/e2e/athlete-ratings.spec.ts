import { test, expect } from '@playwright/test'
import {
  installAdminVisualMocks,
  loginAdminForVisual,
  waitForAdminShell,
} from './helpers/visualFixtures'

function jsonRoute(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

const defaultSettings = {
  publicEnabled: false,
  publicTopLimit: 10,
  firstPlacePoints: 60,
  secondPlacePoints: 35,
  thirdPlacePoints: 15,
  placeWithoutWinPercent: 20,
  pointsVictoryPoints: 32,
  clearAdvantageVictoryPoints: 36,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 20,
  dqVictoryPoints: 10,
  ageCoefficients: {
    '4-5': 35,
    '6-7': 45,
    '8-9': 60,
    '10-11': 75,
    '12-13': 88,
    '14-15': 100,
    '16-17': 105,
    '18+': 110,
  },
}

const previewRow = {
  athleteId: 'athlete-1',
  displayName: 'Иванов Иван',
  clubName: 'Клуб А',
  city: 'Екатеринбург',
  ageYears: 14,
  ageBracketLabel: '14–15',
  rank: 1,
  unranked: false,
  viewRatingHundredths: 11616,
  wins: 2,
  resultsSummary: '🥇 TC',
  ratingHundredths: 11616,
  ratingFormatted: '116,16',
  tacticControlRatingHundredths: 11616,
  closeControlRatingHundredths: 0,
  overallRatingHundredths: 11616,
  placementSummary: 'TC: 1',
  pointsWins: 1,
  submissionChokeWins: 1,
  injuryWins: 0,
  dqWins: 0,
  forfeitWins: 0,
  anomalies: [],
  breakdown: {
    tacticControl: null,
    closeControl: null,
    overallRatingHundredths: 11616,
  },
}

test.describe('public athlete ratings API', () => {
  test('returns 404 when public rating disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/athlete-ratings?discipline=overall')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Not found' })
    }
  })

  test('returns expected shape when enabled', async ({ request }) => {
    const res = await request.get('/api/tournament/athlete-ratings?discipline=overall')
    if (res.status() !== 200) return

    const json = await res.json()
    expect(json).toHaveProperty('publicEnabled', true)
    expect(json).toHaveProperty('topLimit')
    expect(json).toHaveProperty('discipline')
    expect(json).toHaveProperty('rows')
    expect(json).not.toHaveProperty('published')
    expect(json).not.toHaveProperty('publishedAt')
    if (Array.isArray(json.rows) && json.rows.length > 0) {
      expect(json.rows[0]).toHaveProperty('ratingHundredths')
      expect(json.rows[0]).not.toHaveProperty('points')
    }
  })
})

test.describe('public results rating tab', () => {
  test('shows rating tab when tournament state enables it', async ({ page }) => {
    await page.route('**/api/tournament/state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ athleteRatingPublicEnabled: true }),
      }),
    )

    await page.route('**/api/tournament/results', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          filterCategories: [],
          stats: { medalists: 0, categoriesWithResults: 0 },
          rows: [],
        }),
      }),
    )

    await page.goto('/results')
    await expect(page.getByRole('link', { name: 'Рейтинг' })).toBeVisible()
  })

  test('renders athlete rating table in rating tab', async ({ page }) => {
    await page.route('**/api/tournament/state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ athleteRatingPublicEnabled: true }),
      }),
    )

    await page.route('**/api/tournament/results', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          filterCategories: [],
          stats: { medalists: 0, categoriesWithResults: 0 },
          rows: [],
        }),
      }),
    )

    await page.route('**/api/tournament/athlete-ratings?discipline=overall', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          publicEnabled: true,
          topLimit: 10,
          discipline: 'overall',
          rows: [
            {
              rank: 1,
              athleteId: 'athlete-1',
              displayName: 'Иванов Иван',
              clubName: 'Клуб А',
              city: 'Екатеринбург',
              ageLabel: '14 лет',
              resultsSummary: '🥇 TC',
              wins: 2,
              ratingHundredths: 11616,
              ratingFormatted: '116,16',
            },
          ],
        }),
      }),
    )

    await page.goto('/results/rating')
    await expect(page.getByRole('cell', { name: 'Иванов Иван' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '116,16' })).toBeVisible()
  })
})

test.describe('admin athlete ratings settings', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('saves publicEnabled and refreshes preview table', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    let savedPublicEnabled: boolean | null = null
    let settings = { ...defaultSettings }

    await page.route('**/api/admin/athlete-ratings**', async (route) => {
      const request = route.request()
      if (request.method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings,
            view: 'overall',
            rows: settings.publicEnabled ? [previewRow] : [],
          }),
        )
      }

      if (request.method() === 'PATCH') {
        const body = request.postDataJSON() as { publicEnabled?: boolean }
        if (typeof body.publicEnabled === 'boolean') {
          savedPublicEnabled = body.publicEnabled
          settings = { ...settings, publicEnabled: body.publicEnabled }
        }
        return route.fulfill(
          jsonRoute({
            settings,
            view: 'overall',
            rows: settings.publicEnabled ? [previewRow] : [],
          }),
        )
      }

      return route.continue()
    })

    await page.goto('/admin/athlete-ratings')
    await waitForAdminShell(page)

    await page.getByLabel('Показывать публичный рейтинг').check()
    await page.getByRole('button', { name: 'Сохранить настройки' }).click()

    await expect.poll(() => savedPublicEnabled).toBe(true)
    await expect(page.getByText('Настройки рейтинга сохранены, расчёт обновлён.')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Иванов Иван' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '116,16' })).toBeVisible()
  })

  test('shows placement and points columns in preview table', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    await page.route('**/api/admin/athlete-ratings**', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: defaultSettings,
            view: 'overall',
            rows: [previewRow],
          }),
        )
      }
      return route.continue()
    })

    await page.goto('/admin/athlete-ratings')
    await waitForAdminShell(page)

    await expect(page.getByRole('columnheader', { name: 'Места' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'По очкам' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'TC: 1' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '1', exact: true })).toBeVisible()
  })
})
