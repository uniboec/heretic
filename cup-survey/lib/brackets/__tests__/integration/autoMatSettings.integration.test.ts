import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { BoutsPageSettingMissingError } from '../../../bouts/errors'
import { enableAutoMatByCategory } from '../../../bouts/enableAutoMatByCategory'
import { getBoutsPageSettings } from '../../../bouts/service'
import { updateBoutsPageSettings } from '../../../bouts/mutations'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { parseBoutMatAssignments } from '../../../bouts/legacyReleaseGate'
import { AdminBoutsSettingsPatchSchema } from '../../../bouts/schemas'
import {
  cleanupBracketIntegrationData,
  holdBoutsPageSettingRowLock,
  publishAutoAndFixedCategoryDraft,
  resetRegistrationRevision,
  LEGACY_BOUTS_PAGE_SETTING,
  seedBoutsPageSetting,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

import { GET as boutsSettingsGet } from '@/app/api/admin/bouts/settings/route'
import { GET as boutsDashboardGet } from '@/app/api/admin/bouts/route'

function assertReleasedAutoMatchesMode(
  mode: 'BY_CATEGORY' | 'BY_BOUT' | 'BY_CATEGORY_TIME' | 'BY_BOUT_TIME',
  state: { boutsReleased: boolean; boutMatAssignments: unknown } | null,
) {
  if (!state?.boutsReleased) return
  const assignments = parseBoutMatAssignments(state.boutMatAssignments)
  expect(assignments).not.toBeNull()
  const mats = new Set(Object.values(assignments ?? {}))
  if (mode === 'BY_CATEGORY' || mode === 'BY_CATEGORY_TIME') {
    expect(mats.size).toBe(1)
    return
  }

  const boutCount = Object.keys(assignments ?? {}).length
  if (boutCount > 1) {
    expect(mats.size).toBeGreaterThan(1)
  }
}

describe('auto mat settings integration', () => {
  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await seedBoutsPageSetting()
  })

  it('Phase-1 singleton invariant: legacy row is BY_BOUT with marker off', async () => {
    await seedBoutsPageSetting(LEGACY_BOUTS_PAGE_SETTING)
    const row = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(row.autoMatAssignMode).toBe('BY_BOUT')
    expect(row.autoMatByCategoryEnabled).toBe(false)
  })

  it('default singleton uses BY_CATEGORY with marker on', async () => {
    const row = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(row.autoMatAssignMode).toBe('BY_CATEGORY')
    expect(row.autoMatByCategoryEnabled).toBe(true)
  })

  it('PATCH schema accepts autoMatByCategoryEnabled marker field', () => {
    const parsed = AdminBoutsSettingsPatchSchema.safeParse({ autoMatByCategoryEnabled: false })
    expect(parsed.success).toBe(true)
  })

  it('rejects combined PATCH marker off with explicit BY_CATEGORY_TIME mode', async () => {
    await seedBoutsPageSetting()
    await expect(
      updateBoutsPageSettings({
        autoMatByCategoryEnabled: false,
        autoMatAssignMode: 'BY_CATEGORY_TIME',
      }),
    ).rejects.toMatchObject({
      code: 'AUTO_MAT_BY_CATEGORY_NOT_ENABLED',
    })
  })

  it('rejects BY_CATEGORY PATCH when marker is off', async () => {
    await seedBoutsPageSetting(LEGACY_BOUTS_PAGE_SETTING)
    await expect(updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })).rejects.toMatchObject({
      code: 'AUTO_MAT_BY_CATEGORY_NOT_ENABLED',
    })
  })

  it('rejects BY_CATEGORY_TIME PATCH when marker is off', async () => {
    await seedBoutsPageSetting(LEGACY_BOUTS_PAGE_SETTING)
    await expect(
      updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY_TIME' }),
    ).rejects.toMatchObject({
      code: 'AUTO_MAT_BY_CATEGORY_NOT_ENABLED',
    })
  })

  it('enableAutoMatByCategory sets marker and BY_CATEGORY mode', async () => {
    await seedBoutsPageSetting(LEGACY_BOUTS_PAGE_SETTING)
    const result = await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

    expect(result.autoMatByCategoryEnabled).toBe(true)
    expect(result.autoMatAssignMode).toBe('BY_CATEGORY')
  })

  it('enableAutoMatByCategory is idempotent when marker is already on', async () => {
    const result = await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

    expect(result.autoMatByCategoryEnabled).toBe(true)
    expect(result.autoMatAssignMode).toBe('BY_CATEGORY')
  })

  it('enableAutoMatByCategory aborts when singleton row is missing', async () => {
    await prisma.boutsPageSetting.deleteMany()

    await expect(prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))).rejects.toThrow(
      /not found — abort cutover/,
    )
  })

  it('cutover waits while settings row lock is held', async () => {
    await seedBoutsPageSetting(LEGACY_BOUTS_PAGE_SETTING)
    const releaseLock = { done: false }
    const holdPromise = holdBoutsPageSettingRowLock(() => releaseLock.done)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const cutoverPromise = prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
    let cutoverFinished = false
    void cutoverPromise.then(() => {
      cutoverFinished = true
    })

    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(cutoverFinished).toBe(false)

    releaseLock.done = true
    await holdPromise

    const result = await cutoverPromise
    expect(result.autoMatByCategoryEnabled).toBe(true)
  })

  it('GET /api/admin/bouts/settings returns 500 when singleton is missing', async () => {
    await prisma.boutsPageSetting.deleteMany()

    const response = await boutsSettingsGet()
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.errors?.[0]?.code).toBe('BOUTS_PAGE_SETTING_MISSING')
  })

  it('GET /api/admin/bouts returns 500 JSON when singleton is missing', async () => {
    await prisma.boutsPageSetting.deleteMany()

    const response = await boutsDashboardGet()
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.errors?.[0]?.code).toBe('BOUTS_PAGE_SETTING_MISSING')
  })

  it('GET settings service throws when singleton is missing', async () => {
    await prisma.boutsPageSetting.deleteMany()
    await expect(getBoutsPageSettings()).rejects.toBeInstanceOf(BoutsPageSettingMissingError)
  })

  it('combined PATCH prefers matCount invalidation over mode invalidation', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const result = await updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matCount: 2,
        autoMatAssignMode: 'BY_BOUT',
      })

      expect(result.matCountChange).not.toBeNull()
      expect(result.modeChange).toBeNull()
      expect(result.settings.autoMatAssignMode).toBe('BY_BOUT')

      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('marker off release uses BY_BOUT_TIME when stored mode is BY_CATEGORY_TIME', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.boutsPageSetting.update({
        where: { id: 'default' },
        data: { autoMatAssignMode: 'BY_CATEGORY_TIME', autoMatByCategoryEnabled: false },
      })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_BOUT_TIME', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('marker off release uses BY_BOUT even when stored mode is BY_CATEGORY', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.boutsPageSetting.update({
        where: { id: 'default' },
        data: { autoMatAssignMode: 'BY_CATEGORY', autoMatByCategoryEnabled: false },
      })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_BOUT', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('mode change reassigns released Auto categories without unreleasing', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_BOUT' })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      let state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)

      const modeChangeResult = await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
      expect(state?.boutMatAssignments).not.toBeNull()
      expect(modeChangeResult.modeChange?.recomputedReleasedCategoryCount).toBeGreaterThan(0)
      assertReleasedAutoMatchesMode('BY_CATEGORY', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('BY_CATEGORY release assigns all Auto bouts to one mat', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'ready',
        released: true,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const autoState = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      const fixedState = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.fixedKey },
      })

      expect(fixedState?.boutsReleased).toBe(true)
      expect(fixedState?.boutMatAssignments).toBeNull()
      assertReleasedAutoMatchesMode('BY_CATEGORY', autoState)
      const assignments = parseBoutMatAssignments(autoState?.boutMatAssignments)
      expect(assignments).not.toBeNull()
      expect(new Set(Object.values(assignments ?? {})).has(1)).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('concurrency release first: no stale released Auto after mode PATCH', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      const releasePromise = setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })
      await new Promise((resolve) => setTimeout(resolve, 15))
      const patchPromise = updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      await Promise.all([releasePromise, patchPromise])

      const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      expect(settings.autoMatAssignMode).toBe('BY_CATEGORY')
      if (state?.boutsReleased) {
        assertReleasedAutoMatchesMode('BY_CATEGORY', state)
      } else {
        expect(state?.boutsReleased).toBe(false)
      }
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('concurrency PATCH first: release uses new BY_CATEGORY mode', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      const patchPromise = updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })
      await new Promise((resolve) => setTimeout(resolve, 15))
      const releasePromise = setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      await Promise.all([patchPromise, releasePromise])

      const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      expect(settings.autoMatAssignMode).toBe('BY_CATEGORY')
      expect(state?.boutsReleased).toBe(true)
      assertReleasedAutoMatchesMode('BY_CATEGORY', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })
})

describe('auto mat cutover bootstrap regression', () => {
  useIntegrationDb()

  it('seed + enable keeps BY_CATEGORY as stored mode', async () => {
    if (!dbAvailable) return

    await seedBoutsPageSetting()
    await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(settings.autoMatByCategoryEnabled).toBe(true)
    expect(settings.autoMatAssignMode).toBe('BY_CATEGORY')
  })
})

describe('auto mat Phase 3 and fresh install regression', () => {
  useIntegrationDb()

  it('Phase 3 DB default is BY_CATEGORY and singleton matches', async () => {
    if (!dbAvailable) return

    await seedBoutsPageSetting()

    const [columnDefault] = await prisma.$queryRaw<Array<{ column_default: string | null }>>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'BoutsPageSetting'
        AND column_name = 'autoMatAssignMode'
    `
    expect(columnDefault?.column_default).toContain('BY_CATEGORY')

    const singleton = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    expect(singleton.autoMatAssignMode).toBe('BY_CATEGORY')
    expect(singleton.autoMatByCategoryEnabled).toBe(true)
  })

  it('fresh install chain: migrate defaults → cutover → PATCH → re-release BY_CATEGORY', async () => {
    if (!dbAvailable) return

    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await seedBoutsPageSetting()

      let settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      expect(settings.autoMatByCategoryEnabled).toBe(true)
      expect(settings.autoMatAssignMode).toBe('BY_CATEGORY')

      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))

      settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      expect(settings.autoMatByCategoryEnabled).toBe(true)
      expect(settings.autoMatAssignMode).toBe('BY_CATEGORY')

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      let state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_CATEGORY', state)

      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_BOUT' })
      state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
      assertReleasedAutoMatchesMode('BY_BOUT', state)

      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
      assertReleasedAutoMatchesMode('BY_CATEGORY', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('mode change BY_CATEGORY to BY_CATEGORY_TIME keeps Fixed categories unchanged', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'ready',
        released: true,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const fixedBefore = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.fixedKey },
      })
      expect(fixedBefore?.boutsReleased).toBe(true)
      expect(fixedBefore?.boutMatAssignments).toBeNull()

      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY_TIME' })

      const fixedAfter = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.fixedKey },
      })
      expect(fixedAfter?.boutsReleased).toBe(true)
      expect(fixedAfter?.boutMatAssignments).toBeNull()
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('mode change BY_CATEGORY to BY_CATEGORY_TIME reassigns released Auto categories', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const modeChangeResult = await updateBoutsPageSettings({
        autoMatAssignMode: 'BY_CATEGORY_TIME',
      })

      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
      expect(modeChangeResult.modeChange?.recomputedReleasedCategoryCount).toBeGreaterThan(0)
      assertReleasedAutoMatchesMode('BY_CATEGORY_TIME', state)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('timing PATCH boutBreakMinutes triggers reassign in BY_BOUT_TIME mode', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_BOUT_TIME' })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const before = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      const result = await updateBoutsPageSettings({ boutBreakMinutes: 5 })

      const after = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(after?.boutsReleased).toBe(true)
      expect(result.modeChange?.recomputedReleasedCategoryCount).toBeGreaterThan(0)
      expect(after?.matCountAtRelease).toBe(before?.matCountAtRelease)
      expect(after?.boutMatAssignments).toEqual(before?.boutMatAssignments)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('marker off PATCH reassigns released Auto from category-time to bout-time', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY_TIME' })

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'ready',
        released: true,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const before = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_CATEGORY_TIME', before)

      const markerOff = await updateBoutsPageSettings({ autoMatByCategoryEnabled: false })
      const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      expect(settings.autoMatAssignMode).toBe('BY_CATEGORY_TIME')
      expect(settings.autoMatByCategoryEnabled).toBe(false)
      expect(markerOff.modeChange?.recomputedReleasedCategoryCount).toBeGreaterThan(0)

      const after = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_BOUT_TIME', after)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('feature-flag round-trip keeps stored BY_CATEGORY_TIME and restores category-time assignments', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY_TIME' })

      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const releasedCategoryTime = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      assertReleasedAutoMatchesMode('BY_CATEGORY_TIME', releasedCategoryTime)

      await updateBoutsPageSettings({ autoMatByCategoryEnabled: false })
      const markerOffState = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      const storedAfterOff = await prisma.boutsPageSetting.findUniqueOrThrow({
        where: { id: 'default' },
      })
      expect(storedAfterOff.autoMatAssignMode).toBe('BY_CATEGORY_TIME')
      assertReleasedAutoMatchesMode('BY_BOUT_TIME', markerOffState)

      await updateBoutsPageSettings({ autoMatByCategoryEnabled: true })
      const markerOnState = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      const storedAfterOn = await prisma.boutsPageSetting.findUniqueOrThrow({
        where: { id: 'default' },
      })
      expect(storedAfterOn.autoMatAssignMode).toBe('BY_CATEGORY_TIME')
      assertReleasedAutoMatchesMode('BY_CATEGORY_TIME', markerOnState)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('timing PATCH ageDivisionDurationOverrides triggers reassign in BY_BOUT_TIME mode', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_BOUT_TIME' })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const before = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      const result = await updateBoutsPageSettings({
        ageDivisionDurationOverrides: { m_juniors_1: 8 },
      })

      const after = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(result.modeChange?.recomputedReleasedCategoryCount).toBeGreaterThan(0)
      expect(after?.matCountAtRelease).toBe(before?.matCountAtRelease)
      expect(after?.boutMatAssignments).toEqual(before?.boutMatAssignments)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('timing PATCH ageDivisionDurationOverrides does not reassign in BY_CATEGORY count mode', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const before = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      const result = await updateBoutsPageSettings({
        ageDivisionDurationOverrides: { m_juniors_1: 8 },
      })

      const after = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(result.modeChange).toBeNull()
      expect(after?.boutMatAssignments).toEqual(before?.boutMatAssignments)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('timing PATCH boutBreakMinutes does not reassign in BY_CATEGORY count mode', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await prisma.$transaction(async (tx) => enableAutoMatByCategory(tx))
      await updateBoutsPageSettings({ autoMatAssignMode: 'BY_CATEGORY' })

      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.draft.id, prepared.publishedGenerationId)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.autoKey,
        released: true,
        expectedPublishedDrawId: prepared.autoDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const before = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })

      const result = await updateBoutsPageSettings({ boutBreakMinutes: 5 })

      const after = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(result.modeChange).toBeNull()
      expect(after?.boutMatAssignments).toEqual(before?.boutMatAssignments)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })
})
