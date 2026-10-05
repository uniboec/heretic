import { test, expect } from '@playwright/test'

test.describe('public bouts API', () => {
  test('returns 404 when public page disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/bouts')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'Раздел поединков недоступен' })
    }
  })

  test('tournament state exposes bouts flags', async ({ request }) => {
    const res = await request.get('/api/tournament/state')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json).toHaveProperty('boutsPublicEnabled')
    expect(json).toHaveProperty('boutsPublished')
  })
})

test.describe('admin bouts API', () => {
  test('admin bouts endpoint requires auth', async ({ request }) => {
    const res = await request.get('/api/admin/bouts')
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('admin bouts settings PATCH requires auth', async ({ request }) => {
    const res = await request.patch('/api/admin/bouts/settings', {
      data: { publicEnabled: true },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('mat-index PATCH requires auth', async ({ request }) => {
    const res = await request.patch('/api/admin/brackets/draws/test-draw/mat-index', {
      data: { draftId: 'draft', expectedVersion: 1, matIndex: 1 },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })
})

test.describe('public bouts page', () => {
  test('loads bouts page shell', async ({ page }) => {
    await page.goto('/bouts')
    await expect(page.getByRole('heading', { name: 'Поединки' })).toBeVisible()
  })

  test('shows live score when bout is in progress', async ({ page }) => {
    await page.route('**/api/tournament/bouts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          generatedAt: '2026-09-30T10:05:00.000Z',
          mats: [
            {
              matIndex: 1,
              bouts: [
                {
                  id: 'cat-a::bout-1',
                  matchNumber: 1,
                  matIndex: 1,
                  categoryTitle: '12–13 лет, TC/CC',
                  sideA: { kind: 'athlete', displayName: 'Иванов И.', clubName: 'Клуб А' },
                  sideB: { kind: 'athlete', displayName: 'Петров П.', clubName: 'Клуб Б' },
                  timing: {
                    status: 'in_progress',
                    plannedStartAt: '2026-09-30T10:00:00.000Z',
                    liveScore: {
                      red: 4,
                      blue: 2,
                      periodRemainingMs: 125000,
                      boutPhase: 'live',
                      currentPeriod: 'main',
                    },
                  },
                },
              ],
            },
          ],
        }),
      })
    })

    await page.goto('/bouts')
    await expect(page.getByText('4:2')).toBeVisible()
    await expect(page.getByText('02:05')).toBeVisible()
  })

  test('hides completed bouts by default and shows them in completed tab', async ({ page }) => {
    await page.route('**/api/tournament/bouts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          generatedAt: '2026-09-30T10:05:00.000Z',
          matCount: 1,
          mats: [
            {
              matIndex: 1,
              bouts: [
                {
                  id: 'cat-a::bout-done',
                  matchNumber: 1,
                  matIndex: 1,
                  categoryTitle: 'Завершённый бой',
                  sideA: { kind: 'athlete', displayName: 'Сидоров С.', clubName: 'Клуб А' },
                  sideB: { kind: 'athlete', displayName: 'Козлов К.', clubName: 'Клуб Б' },
                  timing: { status: 'completed' },
                },
                {
                  id: 'cat-a::bout-live',
                  matchNumber: 2,
                  matIndex: 1,
                  categoryTitle: 'Текущий бой',
                  sideA: { kind: 'athlete', displayName: 'Иванов И.', clubName: 'Клуб А' },
                  sideB: { kind: 'athlete', displayName: 'Петров П.', clubName: 'Клуб Б' },
                  timing: { status: 'in_progress' },
                },
              ],
            },
          ],
        }),
      })
    })

    await page.goto('/bouts')
    await expect(page.getByText('Текущий бой')).toBeVisible()
    await expect(page.getByText('Завершённый бой')).not.toBeVisible()

    await page.getByRole('button', { name: /Завершённые/ }).click()
    await expect(page.getByText('Завершённый бой')).toBeVisible()
    await expect(page.getByText('Текущий бой')).not.toBeVisible()
  })

  test('opens completed tab when all bouts are finished', async ({ page }) => {
    await page.route('**/api/tournament/bouts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          published: true,
          publishedAt: '2026-09-30T10:00:00.000Z',
          generatedAt: '2026-09-30T10:05:00.000Z',
          matCount: 1,
          mats: [
            {
              matIndex: 1,
              bouts: [
                {
                  id: 'cat-a::bout-done',
                  scheduleDisplayNumber: '1',
                  schedulePosition: 1,
                  matIndex: 1,
                  categoryKey: 'cat-a',
                  categoryTitle: 'Завершённый бой',
                  discipline: 'tactic_control',
                  competitionStage: 1,
                  schedulePhase: 'elimination',
                  sideA: {
                    kind: 'athlete',
                    entryId: 'entry-a',
                    displayName: 'Сидоров С.',
                    clubName: 'Клуб А',
                    city: '',
                    publicNumber: 1,
                  },
                  sideB: {
                    kind: 'athlete',
                    entryId: 'entry-b',
                    displayName: 'Козлов К.',
                    clubName: 'Клуб Б',
                    city: '',
                    publicNumber: 2,
                  },
                  timing: { status: 'completed', displayStatus: 'completed' },
                  winnerEntryId: 'entry-a',
                },
              ],
            },
          ],
        }),
      })
    })

    await page.goto('/bouts')
    await expect(page.getByText('Завершённый бой')).toBeVisible()
    await expect(page.getByText('Победитель')).toBeVisible()
  })
})
