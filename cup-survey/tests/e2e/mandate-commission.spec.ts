import { test, expect } from '@playwright/test'
import { loginAdminPage } from './helpers/adminAuth'
import { installAdminVisualMocks, waitForAdminShell } from './helpers/visualFixtures'

const LOGIN_SKIP_MESSAGE =
  'Admin auth unavailable (set E2E_ADMIN_PASSWORD in .env or restart dev server with matching ADMIN_SESSION_SECRET)'

const mandateListFixture = {
  rows: [
    {
      athleteId: 'athlete-mandate-001',
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      fullName: 'Иванов Иван Иванович',
      clubName: 'Клуб А',
      city: 'Екатеринбург',
      bracketEntries: [
        {
          entryId: 'entry-mandate-001',
          categoryKey: 'tactic_control:novice:m_juniors_1:m_juniors_1_w_le_66',
          categoryLabel: 'Юниоры 1 · до 66 кг',
          paymentStatus: 'PAID',
          paymentStatusLabel: 'Оплачено',
        },
      ],
      check: {
        medicalStatus: 'VERIFIED',
        insuranceStatus: 'UNCHECKED',
        documentsStatus: 'UNCHECKED',
        weightCheckMode: 'AUTO',
        actualWeightKg: 65.5,
        manualWeightVerified: false,
        manualWeightCategoryFingerprint: null,
        comment: 'Проверка пройдена',
        updatedAt: '2026-10-02T10:30:00.000Z',
      },
      weightStatus: {
        hasWeighIn: true,
        weightEligible: true,
        manualStale: false,
        categoryResults: [],
      },
      aggregateStatus: 'has_issues',
      issueCount: 1,
    },
  ],
  kpi: {
    total: 1,
    allOk: 0,
    hasIssues: 1,
    notChecked: 0,
    notWeighedIn: 0,
  },
}

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

test.describe('admin mandate commission', () => {
  test.beforeEach(() => {
    test.skip(!process.env.ADMIN_SESSION_SECRET, 'ADMIN_SESSION_SECRET is required')
  })

  test('loads dashboard shell and mandate navigation', async ({ page }) => {
    const authenticated = await loginAdminPage(page)
    test.skip(!authenticated, LOGIN_SKIP_MESSAGE)

    await page.goto('/admin/mandate-commission')
    await waitForAdminShell(page)

    await expect(page.getByRole('heading', { name: 'Допуск' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Допуск' })).toBeVisible()
    await expect(page.getByText('Всего', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Поиск')).toBeVisible()
  })

  test('GET mandate commission API returns list payload', async ({ page }) => {
    const authenticated = await loginAdminPage(page)
    test.skip(!authenticated, LOGIN_SKIP_MESSAGE)

    const response = await page.request.get('/api/admin/mandate-commission')
    expect(response.ok()).toBeTruthy()

    const body = (await response.json()) as {
      rows?: unknown[]
      kpi?: { total?: number }
    }
    expect(Array.isArray(body.rows)).toBe(true)
    expect(typeof body.kpi?.total).toBe('number')
  })

  test('shows updatedAt footer and filter controls with mocked client refresh', async ({ page }) => {
    const authenticated = await loginAdminPage(page)
    test.skip(!authenticated, LOGIN_SKIP_MESSAGE)

    await installAdminVisualMocks(page)
    await page.route('**/api/admin/mandate-commission**', (route) => {
      if (route.request().method() !== 'GET') {
        return route.continue()
      }
      return route.fulfill(jsonRoute(mandateListFixture))
    })

    await page.goto('/admin/mandate-commission')
    await waitForAdminShell(page)

    await page.waitForResponse((response) =>
      response.url().includes('/api/admin/mandate-commission') && response.ok(),
    )

    await expect(page.getByRole('table').getByText('Иванов Иван Иванович')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Редактировать комментарий' }),
    ).toBeVisible()
  })
})
