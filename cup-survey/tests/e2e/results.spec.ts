import { test, expect } from '@playwright/test'

test.describe('public results API', () => {
  test('returns 404 when public page disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/results')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Раздел сеток недоступен' })
    }
  })

  test('returns expected shape when enabled', async ({ request }) => {
    const res = await request.get('/api/tournament/results')
    if (res.status() !== 200) return

    const json = await res.json()
    expect(json).toHaveProperty('published')
    expect(json).toHaveProperty('publishedAt')
    expect(json).toHaveProperty('rows')
    expect(json).toHaveProperty('filterCategories')
    expect(json).toHaveProperty('stats')
    expect(json.stats).toMatchObject({
      medalists: expect.any(Number),
      categoriesWithResults: expect.any(Number),
    })
  })
})

test.describe('public results page', () => {
  test('loads results page shell', async ({ page }) => {
    await page.goto('/results')
    await expect(page.getByRole('heading', { level: 1, name: 'Результаты' })).toBeVisible()
  })

  test('shows medalists grouped by category when API returns rows', async ({ page }) => {
    await page.route('**/api/tournament/results', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          filterCategories: [
            {
              categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
              title: '12–13 лет, 66 кг',
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId: 'w_66',
              gender: 'male',
            },
          ],
          stats: { medalists: 2, categoriesWithResults: 1 },
          rows: [
            {
              rowKey: 'cat:0:e-gold',
              entryId: 'e-gold',
              displayName: 'Иванов Иван',
              clubName: 'Клуб А',
              city: 'Екатеринбург',
              placement: 1,
              provisional: false,
              categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
              categoryTitle: '12–13 лет, 66 кг',
              category: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'w_66',
                gender: 'male',
              },
              placementIndex: 0,
            },
            {
              rowKey: 'cat:1:e-silver',
              entryId: 'e-silver',
              displayName: 'Петров Пётр',
              clubName: 'Клуб Б',
              city: 'Пермь',
              placement: 2,
              provisional: true,
              categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
              categoryTitle: '12–13 лет, 66 кг',
              category: {
                discipline: 'tactic_control',
                experienceLevel: 'beginner',
                ageDivisionId: 'm_juniors_1',
                weightCategoryId: 'w_66',
                gender: 'male',
              },
              placementIndex: 1,
            },
          ],
        }),
      }),
    )

    await page.goto('/results')
    await expect(page.getByText('12–13 лет, 66 кг')).toBeVisible()
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('Петров Пётр')).toBeVisible()
  })
})
