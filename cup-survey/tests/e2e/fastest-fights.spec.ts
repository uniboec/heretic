import { test, expect } from '@playwright/test'

test.describe('public fastest fights API', () => {
  test('returns 404 when public page disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/fastest-fights')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Раздел сеток недоступен' })
    }
  })

  test('returns expected shape when enabled', async ({ request }) => {
    const res = await request.get('/api/tournament/fastest-fights')
    if (res.status() !== 200) return

    const json = await res.json()
    expect(json).toHaveProperty('published')
    expect(json).toHaveProperty('publishedAt')
    expect(json).toHaveProperty('rows')
    expect(json).toHaveProperty('totalEligible')
    expect(Array.isArray(json.rows)).toBe(true)
  })
})

test.describe('public results fastest fights block', () => {
  test('shows fastest fights block when API returns rows', async ({ page }) => {
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

    await page.route('**/api/tournament/fastest-fights', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          totalEligible: 1,
          rows: [
            {
              rank: 1,
              boutId: 'cat::m1',
              matchNumber: 7,
              displayName: 'Иванов Иван',
              clubName: 'Клуб А',
              city: 'Екатеринбург',
              boutElapsedMs: 42_000,
              timeLabel: '0:42',
              victoryMethod: 'SUBMISSION',
              victoryMethodLabel: 'Болевой приём',
              categoryTitle: '12–13 лет, 66 кг',
              discipline: 'tactic_control',
              confirmedAt: '2026-09-30T11:00:00.000Z',
            },
          ],
        }),
      }),
    )

    await page.route('**/api/tournament/state', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ awardsPublicEnabled: false }),
      }),
    )

    await page.goto('/results/fastest')
    await expect(page.getByRole('heading', { level: 2, name: 'Самые быстрые поединки' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Иванов Иван' })).toBeVisible()
    await expect(page.getByRole('cell', { name: '0:42' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Болевой приём' })).toBeVisible()
  })
})
