import { test, expect } from '@playwright/test'

test.describe('public brackets API', () => {
  test('returns 404 when public page disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/brackets')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Раздел сеток недоступен' })
    }
  })

  test('tournament state exposes bracket flags', async ({ request }) => {
    const res = await request.get('/api/tournament/state')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json).toHaveProperty('bracketsPublicEnabled')
    expect(json).toHaveProperty('bracketsPublished')
  })
})

test.describe('health check', () => {
  test('bracket deploy guard endpoint', async ({ request }) => {
    const res = await request.get('/api/health')
    expect([200, 503]).toContain(res.status())
    const json = await res.json()
    expect(json).toHaveProperty('ok')
  })
})

test.describe('admin brackets API', () => {
  test('admin brackets endpoint requires auth', async ({ request }) => {
    const res = await request.get('/api/admin/brackets')
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('legacy publish endpoint requires auth or is removed', async ({ request }) => {
    const res = await request.post('/api/admin/brackets/publish', {
      data: { draftId: '00000000-0000-0000-0000-000000000001', expectedVersion: 1 },
    })
    expect([401, 403, 302, 307, 410]).toContain(res.status())
  })

  test('generate endpoint requires auth', async ({ request }) => {
    const res = await request.post('/api/admin/brackets/generate', {
      data: { draftId: '00000000-0000-0000-0000-000000000001', expectedVersion: 1, mode: 'SYNC', scope: 'all' },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('format-rules PATCH requires auth', async ({ request }) => {
    const res = await request.patch('/api/admin/brackets/format-rules', {
      data: { draftId: '00000000-0000-0000-0000-000000000001', expectedVersion: 1, rules: [] },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })
})

test.describe('public brackets page', () => {
  test('loads brackets page shell', async ({ page }) => {
    await page.goto('/brackets')
    await expect(page.getByRole('heading', { level: 1, name: 'Сетки' })).toBeVisible()
  })

  test('shows bout winner and podium when category result is complete', async ({ page }) => {
    await page.route('**/api/tournament/brackets', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-20T10:00:00.000Z',
          categories: [
            {
              categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
              discipline: 'tactic_control',
              title: '12–13 лет, 66 кг',
              systemId: 'olympic',
              systemVersion: 1,
              bronzeMode: 'ONE',
              participants: [
                {
                  entryId: 'entry-red',
                  seedPosition: 1,
                  displayName: 'Иванов Иван',
                  clubName: 'Клуб А',
                  city: 'Екатеринбург',
                },
                {
                  entryId: 'entry-blue',
                  seedPosition: 2,
                  displayName: 'Петров Пётр',
                  clubName: 'Клуб Б',
                  city: 'Пермь',
                },
              ],
              structure: {
                systemId: 'olympic',
                systemVersion: 1,
                rounds: [
                  {
                    id: 'bout-1',
                    round: 1,
                    slot: 1,
                    matchNumber: 1,
                    participantA: {
                      entryId: 'entry-red',
                      displayName: 'Иванов Иван',
                      clubName: 'Клуб А',
                      city: 'Екатеринбург',
                      clubIdentity: 'Клуб А::Екатеринбург',
                      publicNumber: 1,
                      seedPosition: 1,
                      seedLocked: false,
                    },
                    participantB: {
                      entryId: 'entry-blue',
                      displayName: 'Петров Пётр',
                      clubName: 'Клуб Б',
                      city: 'Пермь',
                      clubIdentity: 'Клуб Б::Пермь',
                      publicNumber: 2,
                      seedPosition: 2,
                      seedLocked: false,
                    },
                    winnerEntryId: 'entry-red',
                    loserEntryId: 'entry-blue',
                  },
                ],
                result: {
                  status: 'complete',
                  placements: [
                    { entryId: 'entry-red', placement: 1, reason: 'FINAL_WINNER' },
                    { entryId: 'entry-blue', placement: 2, reason: 'FINAL_LOSER' },
                  ],
                },
              },
              result: {
                status: 'complete',
                placements: [
                  { entryId: 'entry-red', placement: 1, reason: 'FINAL_WINNER' },
                  { entryId: 'entry-blue', placement: 2, reason: 'FINAL_LOSER' },
                ],
              },
            },
          ],
        }),
      }),
    )

    await page.goto('/brackets')
    await page.getByRole('button', { name: /Завершённые/ }).click()
    await expect(page.getByRole('heading', { name: '12–13 лет, 66 кг' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Призёры категории' }).getByText('Иванов Иван'),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('.bracket-match__participant--winner')).toBeVisible()
  })
})

test.describe('bracket deployment characterization (F)', () => {
  test('public API stays stable when brackets disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/brackets')
    expect([200, 404]).toContain(res.status())
  })

  test('visibility endpoint requires auth and rejects anonymous toggles', async ({ request }) => {
    const res = await request.post('/api/admin/brackets/visibility', {
      data: { scope: 'category', categoryKey: 'demo:cat', visible: true },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('brackets page stays available while public API may be disabled', async ({ page, request }) => {
    const api = await request.get('/api/tournament/brackets')
    await page.goto('/brackets')
    await expect(page.getByRole('heading', { level: 1, name: 'Сетки' })).toBeVisible()
    expect([200, 404]).toContain(api.status())
  })
})

test.describe('bracket lifecycle API characterization', () => {
  test('public brackets endpoint shape when enabled', async ({ request }) => {
    const res = await request.get('/api/tournament/brackets')
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Раздел сеток недоступен' })
      return
    }
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json).toHaveProperty('published')
    expect(json).toHaveProperty('categories')
    if (json.published) {
      expect(Array.isArray(json.categories)).toBe(true)
    }
  })
})
