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

test.describe('public awards API', () => {
  test('returns 404 when public page disabled', async ({ request }) => {
    const res = await request.get('/api/tournament/awards')
    expect([200, 404]).toContain(res.status())
    if (res.status() === 404) {
      expect(await res.json()).toEqual({ error: 'NOT_FOUND' })
    }
  })

  test('tournament state exposes awards flag', async ({ request }) => {
    const res = await request.get('/api/tournament/state')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json).toHaveProperty('awardsPublicEnabled')
  })
})

test.describe('admin awards API', () => {
  test('admin awards endpoint requires auth', async ({ request }) => {
    const res = await request.get('/api/admin/awards')
    expect([401, 403, 302, 307]).toContain(res.status())
  })

  test('admin awards settings PATCH requires auth', async ({ request }) => {
    const res = await request.patch('/api/admin/awards/settings', {
      data: { publicEnabled: true },
    })
    expect([401, 403, 302, 307]).toContain(res.status())
  })
})

test.describe('public awards page', () => {
  test('loads awards page shell', async ({ page }) => {
    await page.goto('/awards')
    await expect(page.getByRole('heading', { name: 'Награждение' })).toBeVisible()
  })

  test('shows disabled state when API returns 404', async ({ page }) => {
    await page.route('**/api/tournament/awards', async (route) => {
      await route.fulfill(jsonRoute({ error: 'NOT_FOUND' }, 404))
    })

    await page.goto('/awards')
    await expect(page.getByText('Раздел недоступен', { exact: true })).toBeVisible()
  })

  test('shows empty state when queue is empty', async ({ page }) => {
    await page.route('**/api/tournament/awards', async (route) => {
      await route.fulfill(
        jsonRoute({
          published: true,
          ceremonyStartTime: '11:00',
          generatedAt: new Date().toISOString(),
          queue: [],
          completed: [],
        }),
      )
    })

    await page.goto('/awards')
    await expect(
      page.getByText('Расписание награждения пока формируется', { exact: true }),
    ).toBeVisible()
  })

  test('shows completed tab with ceremony time label', async ({ page }) => {
    await page.route('**/api/tournament/awards', async (route) => {
      await route.fulfill(
        jsonRoute({
          published: true,
          ceremonyStartTime: '11:00',
          generatedAt: new Date().toISOString(),
          queue: [],
          completed: [
            {
              queueId: 'q-done',
              categoryKey: 'cat-done',
              categoryTitle: 'Мужчины до 70 кг',
              completedAt: '2026-10-03T06:10:00.000Z',
              completedAtLabel: '14:32',
              ceremonySequence: 1,
              publicComment: null,
              placements: [
                {
                  id: 'p1',
                  entryId: 'e1',
                  placement: 1,
                  placementIndex: 0,
                  displayName: 'Иванов Иван',
                  clubName: 'Клуб 1',
                  status: 'AWARDED',
                  publicComment: null,
                },
              ],
            },
          ],
        }),
      )
    })

    await page.goto('/awards')
    await page.getByRole('button', { name: 'Награждённые' }).click()
    await expect(page.getByText('Награждение завершено в 14:32')).toBeVisible()
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('Вручено')).toBeVisible()
  })

  test('hides awards nav when disabled', async ({ page }) => {
    await page.route('**/api/tournament/state', async (route) => {
      const response = await route.fetch()
      const json = await response.json()
      await route.fulfill(
        jsonRoute({
          ...json,
          awardsPublicEnabled: false,
        }),
      )
    })

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Награждение' })).toHaveCount(0)
  })

  test('filters awards list by search query', async ({ page }) => {
    await page.route('**/api/tournament/awards', async (route) => {
      await route.fulfill(
        jsonRoute({
          published: true,
          ceremonyStartTime: '11:00',
          generatedAt: new Date().toISOString(),
          completed: [],
          queue: [
            {
              queueId: 'q1',
              categoryKey: 'cat-a',
              categoryTitle: 'Категория A',
              status: 'PENDING',
              estimatedTimeLabel: '11:00',
              publicComment: null,
              placements: [
                {
                  id: 'p1',
                  entryId: 'e1',
                  placement: 1,
                  placementIndex: 0,
                  displayName: 'Иванов Иван',
                  clubName: 'Клуб 1',
                  status: 'PENDING',
                  publicComment: null,
                },
              ],
            },
            {
              queueId: 'q2',
              categoryKey: 'cat-b',
              categoryTitle: 'Категория B',
              status: 'PENDING',
              estimatedTimeLabel: '11:03',
              publicComment: null,
              placements: [
                {
                  id: 'p2',
                  entryId: 'e2',
                  placement: 1,
                  placementIndex: 0,
                  displayName: 'Петров Пётр',
                  clubName: 'Клуб 2',
                  status: 'PENDING',
                  publicComment: null,
                },
              ],
            },
          ],
        }),
      )
    })

    await page.goto('/awards')
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('Петров Пётр')).toBeVisible()

    await page.getByPlaceholder('Фамилия, имя, клуб или категория').fill('Петров')
    await expect(page.getByText('Петров Пётр')).toBeVisible()
    await expect(page.getByText('Иванов Иван')).toHaveCount(0)
  })

  test('shows four medalists for olympic two bronze category', async ({ page }) => {
    await page.route('**/api/tournament/awards', async (route) => {
      await route.fulfill(
        jsonRoute({
          published: true,
          ceremonyStartTime: '11:00',
          generatedAt: new Date().toISOString(),
          completed: [],
          queue: [
            {
              queueId: 'q1',
              categoryKey: 'cat-olympic-two',
              categoryTitle: 'Мужчины до 70 кг',
              status: 'PENDING',
              estimatedTimeLabel: '11:00',
              publicComment: null,
              placements: [
                {
                  id: 'p1',
                  entryId: 'e1',
                  placement: 1,
                  placementIndex: 0,
                  displayName: 'Иванов Иван',
                  clubName: 'Клуб 1',
                  status: 'PENDING',
                },
                {
                  id: 'p2',
                  entryId: 'e2',
                  placement: 2,
                  placementIndex: 1,
                  displayName: 'Петров Пётр',
                  clubName: 'Клуб 2',
                  status: 'PENDING',
                },
                {
                  id: 'p3',
                  entryId: 'e3',
                  placement: 3,
                  placementIndex: 2,
                  displayName: 'Сидоров Сидор',
                  clubName: 'Клуб 3',
                  status: 'PENDING',
                },
                {
                  id: 'p4',
                  entryId: 'e4',
                  placement: 3,
                  placementIndex: 3,
                  displayName: 'Козлов Козьма',
                  clubName: 'Клуб 4',
                  status: 'PENDING',
                },
              ],
            },
          ],
        }),
      )
    })

    await page.goto('/awards')
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('Петров Пётр')).toBeVisible()
    await expect(page.getByText('Сидоров Сидор')).toBeVisible()
    await expect(page.getByText('Козлов Козьма')).toBeVisible()
    await expect(page.locator('article li')).toHaveCount(4)
  })
})

test.describe('admin awards settings UX', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('saves publicEnabled from settings panel', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    let savedPublicEnabled: boolean | null = null
    let publicEnabled = false

    await page.route('**/api/admin/awards/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { publicEnabled?: boolean }
        if (typeof body.publicEnabled === 'boolean') {
          savedPublicEnabled = body.publicEnabled
          publicEnabled = body.publicEnabled
        }
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: body.publicEnabled ?? false,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision: 0,
            },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision: 0,
            },
            queueRevision: 0,
            queue: [],
            completed: [],
            needsReview: [],
            remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
          }),
        )
      }
      return route.continue()
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)

    await page.getByText('Публичная страница «Награждение»').click()
    await expect.poll(() => savedPublicEnabled).toBe(true)
    await expect(page.getByText('Настройки сохранены')).toBeVisible()

    await page.getByText('Публичная страница «Награждение»').click()
    await expect.poll(() => savedPublicEnabled).toBe(false)
  })

  test('saves ceremony timing from settings panel', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    let savedTiming: Record<string, unknown> | null = null

    await page.route('**/api/admin/awards/settings', async (route) => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>
        savedTiming = body
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: body.ceremonyStartTime ?? '11:00',
              ceremonyDurationMinutes: body.ceremonyDurationMinutes ?? 3,
              ceremonyBreakMinutes: body.ceremonyBreakMinutes ?? 0,
              queueRevision: 0,
            },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision: 0,
            },
            queue: [],
            completed: [],
            needsReview: [],
            remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
          }),
        )
      }
      return route.continue()
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)
    await expect(page.getByRole('heading', { name: 'Настройки награждения' })).toBeVisible()

    await page.getByLabel('Длительность категории').fill('5')
    await page.getByRole('button', { name: 'Сохранить расписание' }).click()

    await expect.poll(() => savedTiming).toEqual({
      ceremonyStartTime: '11:00',
      ceremonyDurationMinutes: 5,
      ceremonyBreakMinutes: 0,
    })
    await expect(page.getByText('Расписание сохранено')).toBeVisible()
  })

  test('shows conflict toast on stale reorder', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision: 2,
            },
            queueRevision: 2,
            queue: [
              {
                queueId: 'queue-1',
                categoryKey: 'cat-a',
                categoryTitle: 'Категория A',
                status: 'PENDING',
                queueGroup: 'NORMAL',
                queueOrder: 0,
                revision: 0,
                needsReview: false,
                conflictReason: null,
                ceremonySequence: null,
                estimatedTimeLabel: '11:00',
                placements: [],
                publicComment: null,
                adminComment: null,
              },
            ],
            completed: [],
            needsReview: [],
            remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards/queue', async (route) => {
      await route.fulfill(
        jsonRoute(
          {
            code: 'QUEUE_REVISION_CONFLICT',
            error: 'Queue revision conflict',
          },
          409,
        ),
      )
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)
    await page.getByRole('button', { name: 'Ниже' }).first().click()
    await expect(page.getByText('Очередь изменилась. Страница обновлена.')).toBeVisible()
  })

  test('shows remaining medals tab and late award action', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    let lateAwardCalled = false

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision: 0,
            },
            queueRevision: 0,
            queue: [],
            completed: [
              {
                queueId: 'queue-completed',
                categoryKey: 'cat-done',
                categoryTitle: 'Категория завершена',
                status: 'COMPLETED',
                queueGroup: 'NORMAL',
                queueOrder: 0,
                revision: 2,
                needsReview: false,
                conflictReason: null,
                ceremonySequence: 1,
                estimatedTimeLabel: '11:00',
                adminComment: null,
                publicComment: null,
                placements: [
                  {
                    id: 'placement-late',
                    entryId: 'late-1',
                    placement: 3,
                    placementIndex: 0,
                    displayName: 'Иванов Иван',
                    clubName: 'Клуб 1',
                    status: 'NOT_AWARDED',
                    resolvedAt: '14:32',
                    adminComment: 'уехал домой',
                    publicComment: null,
                  },
                ],
              },
            ],
            needsReview: [],
            remainingMedals: {
              summary: { gold: 0, silver: 0, bronze: 1 },
              items: [
                {
                  placementId: 'placement-late',
                  queueId: 'queue-completed',
                  categoryKey: 'cat-done',
                  categoryTitle: 'Категория завершена',
                  placement: 3,
                  medal: '🥉',
                  displayName: 'Иванов Иван',
                  clubName: 'Клуб 1',
                  resolvedAt: '14:32',
                  comment: 'уехал домой',
                },
              ],
            },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards/placements/placement-late', async (route) => {
      if (route.request().method() === 'PATCH') {
        lateAwardCalled = true
        return route.fulfill(
          jsonRoute({
            queueId: 'queue-completed',
            revision: 3,
            queueRevision: 0,
          }),
        )
      }
      return route.continue()
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)
    await page.getByRole('button', { name: 'Остатки' }).click()
    await expect(page.getByText('Иванов Иван')).toBeVisible()
    await expect(page.getByText('уехал домой')).toBeVisible()
    await page.getByRole('button', { name: 'Выдать' }).click()
    await expect.poll(() => lateAwardCalled).toBe(true)
  })

  test('runs single ceremony flow after bulk complete for two categories', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    const bulkCalls: string[] = []
    let queueRevision = 0

    type QueueCategory = {
      queueId: string
      categoryKey: string
      categoryTitle: string
      status: 'PENDING'
      queueGroup: 'NORMAL'
      queueOrder: number
      revision: number
      needsReview: boolean
      conflictReason: null
      ceremonySequence: null
      estimatedTimeLabel: string
      adminComment: null
      publicComment: null
      placements: Array<{
        id: string
        entryId: string
        placement: number
        placementIndex: number
        displayName: string
        clubName: string
        status: 'PENDING'
        resolvedAt: null
        adminComment: null
        publicComment: null
      }>
    }

    let queue: QueueCategory[] = [
      {
        queueId: 'queue-1',
        categoryKey: 'cat-a',
        categoryTitle: 'Категория A',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 0,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:00',
        adminComment: null,
        publicComment: null,
        placements: [
          {
            id: 'p-a',
            entryId: 'a1',
            placement: 1,
            placementIndex: 0,
            displayName: 'A A',
            clubName: 'C1',
            status: 'PENDING',
            resolvedAt: null,
            adminComment: null,
            publicComment: null,
          },
        ],
      },
      {
        queueId: 'queue-2',
        categoryKey: 'cat-b',
        categoryTitle: 'Категория B',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 1,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:03',
        adminComment: null,
        publicComment: null,
        placements: [
          {
            id: 'p-b',
            entryId: 'b1',
            placement: 1,
            placementIndex: 0,
            displayName: 'B B',
            clubName: 'C2',
            status: 'PENDING',
            resolvedAt: null,
            adminComment: null,
            publicComment: null,
          },
        ],
      },
    ]

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision,
            },
            queue,
            completed: [],
            needsReview: [],
            remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards/complete', async (route) => {
      const body = route.request().postDataJSON() as { queueId?: string }
      if (body.queueId) {
        bulkCalls.push(body.queueId)
        queue = queue.filter((item) => item.queueId !== body.queueId)
        queueRevision += 1
      }
      return route.fulfill(
        jsonRoute({
          queueId: body.queueId,
          revision: 1,
          queueRevision,
        }),
      )
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)

    await page.getByRole('button', { name: 'Подтвердить категорию' }).first().click()
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
    await page.getByRole('button', { name: 'Подтвердить категорию' }).first().click()
    await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()

    await expect.poll(() => bulkCalls.sort()).toEqual(['queue-1', 'queue-2'])
  })

  test('keeps deferred category after moveToEnd when a new category is enqueued', async ({ page }) => {
    await installAdminVisualMocks(page)
    await loginAdminForVisual(page)

    type QueueCategory = {
      queueId: string
      categoryKey: string
      categoryTitle: string
      status: 'PENDING'
      queueGroup: 'NORMAL' | 'DEFERRED'
      queueOrder: number
      revision: number
      needsReview: boolean
      conflictReason: string | null
      ceremonySequence: null
      estimatedTimeLabel: string
      adminComment: null
      publicComment: null
      placements: []
    }

    let queue: QueueCategory[] = [
      {
        queueId: 'queue-a',
        categoryKey: 'cat-a',
        categoryTitle: 'Категория A',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 0,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:00',
        adminComment: null,
        publicComment: null,
        placements: [],
      },
      {
        queueId: 'queue-b',
        categoryKey: 'cat-b',
        categoryTitle: 'Категория B',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 1,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:03',
        adminComment: null,
        publicComment: null,
        placements: [],
      },
      {
        queueId: 'queue-c',
        categoryKey: 'cat-c',
        categoryTitle: 'Категория C',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 2,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:06',
        adminComment: null,
        publicComment: null,
        placements: [],
      },
    ]
    let queueRevision = 0

    await page.route('**/api/admin/awards', async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill(
          jsonRoute({
            settings: {
              publicEnabled: true,
              ceremonyStartTime: '11:00',
              ceremonyDurationMinutes: 3,
              ceremonyBreakMinutes: 0,
              queueRevision,
            },
            queue,
            completed: [],
            needsReview: [],
            remainingMedals: { summary: { gold: 0, silver: 0, bronze: 0 }, items: [] },
          }),
        )
      }
      return route.continue()
    })

    await page.route('**/api/admin/awards/queue', async (route) => {
      const body = route.request().postDataJSON() as {
        queueId?: string
        action?: string
      }

      if (body.action === 'moveToEnd' && body.queueId === 'queue-c') {
        queue = queue.map((item) =>
          item.queueId === 'queue-c'
            ? { ...item, queueGroup: 'DEFERRED', queueOrder: 0 }
            : item,
        )
        queueRevision += 1
      }

      return route.fulfill(jsonRoute({ queueRevision, changed: true }))
    })

    await page.goto('/admin/awards')
    await waitForAdminShell(page)

    const categoryCSection = page.locator('section', { hasText: 'Категория C' })
    await categoryCSection.getByRole('button', { name: 'В конец' }).click()

    queue = [
      ...queue.filter((item) => item.queueGroup === 'NORMAL'),
      {
        queueId: 'queue-d',
        categoryKey: 'cat-d',
        categoryTitle: 'Категория D',
        status: 'PENDING',
        queueGroup: 'NORMAL',
        queueOrder: 2,
        revision: 0,
        needsReview: false,
        conflictReason: null,
        ceremonySequence: null,
        estimatedTimeLabel: '11:09',
        adminComment: null,
        publicComment: null,
        placements: [],
      },
      ...queue.filter((item) => item.queueGroup === 'DEFERRED'),
    ]
    queueRevision += 1

    await page.reload()
    await waitForAdminShell(page)

    const categoryTitles = page
      .locator('section')
      .filter({ has: page.getByRole('button', { name: 'Подтвердить категорию' }) })
      .locator('h3')
    await expect(categoryTitles.nth(0)).toHaveText('Категория A')
    await expect(categoryTitles.nth(1)).toHaveText('Категория B')
    await expect(categoryTitles.nth(2)).toHaveText('Категория D')
    await expect(categoryTitles.nth(3)).toHaveText('Категория C')
  })
})
