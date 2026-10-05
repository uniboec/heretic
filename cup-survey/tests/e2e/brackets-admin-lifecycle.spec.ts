import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { loginAsAdmin } from './helpers/adminAuth'

const prisma = new PrismaClient()

test.describe('admin bracket lifecycle (F)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('sync → redraw → visibility → public read', async ({ request }) => {
    const authenticated = await loginAsAdmin(request)
    test.skip(!authenticated, 'Admin login is not configured for E2E')

    const dashboardRes = await request.get('/api/admin/brackets')
    expect(dashboardRes.ok()).toBeTruthy()
    const dashboard = await dashboardRes.json()
    expect(dashboard.draft?.id).toBeTruthy()

    const syncRes = await request.post('/api/admin/brackets/generate', {
      data: {
        draftId: dashboard.draft.id,
        expectedVersion: dashboard.draft.version,
        mode: 'SYNC',
        scope: 'all',
      },
    })
    expect(syncRes.ok()).toBeTruthy()
    const synced = await syncRes.json()

    const redrawRes = await request.post('/api/admin/brackets/generate', {
      data: {
        draftId: synced.draft.id,
        expectedVersion: synced.draft.version,
        mode: 'REDRAW',
        scope: 'all',
      },
    })
    expect(redrawRes.ok()).toBeTruthy()
    const redrawn = await redrawRes.json()

    const afterRedraw = await request.get('/api/admin/brackets')
    expect(afterRedraw.ok()).toBeTruthy()
    const dashboardAfter = await afterRedraw.json()
    const categoryKey = dashboardAfter.categories?.[0]?.categoryKey
    test.skip(!categoryKey, 'No categories available for visibility toggle')

    const visibilityRes = await request.post('/api/admin/brackets/visibility', {
      data: {
        scope: 'category',
        categoryKey,
        visible: true,
      },
    })
    expect(visibilityRes.ok()).toBeTruthy()

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    const publicRes = await request.get('/api/tournament/brackets')
    expect([200, 404]).toContain(publicRes.status())
    if (publicRes.ok()) {
      const publicData = await publicRes.json()
      expect(publicData.published).toBe(true)
      expect(
        publicData.categories.some(
          (category: { categoryKey: string }) => category.categoryKey === categoryKey,
        ),
      ).toBe(true)
    }
  })
})
