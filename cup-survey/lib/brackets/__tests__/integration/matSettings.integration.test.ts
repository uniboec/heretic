import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { prisma } from '../../../prisma'
import {
  BoutsValidationError,
  MatCountDemotionConfirmationRequiredError,
} from '../../../bouts/errors'
import { VersionConflictError, DraftConflictError } from '../../core/errors'
import { updateBoutsPageSettings, updateBracketDrawMatIndex } from '../../../bouts/mutations'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { publishBracketDraft } from '../../generation/publish'
import {
  CAT_A,
  CAT_B,
  createIsolatedDraft,
  ensureBracketDefaults,
  preparePublishableDraft,
  publishAutoAndFixedCategoryDraft,
  purgeBracketIntegrationState,
  resetRegistrationRevision,
  cleanupBracketIntegrationData,
  seedBoutsPageSetting,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('bouts mat settings integration', () => {
  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
    await seedBoutsPageSetting()
  })

  it('returns 409 demotion confirmation when draft draw exceeds new matCount', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test',
        drawSeed: 'seed',
        matIndex: 3,
      },
    })

    await expect(
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 1,
      }),
    ).rejects.toBeInstanceOf(MatCountDemotionConfirmationRequiredError)
  })

  it('demotes out-of-range Fixed after confirmation', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    const draw = await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test',
        drawSeed: 'seed',
        matIndex: 3,
      },
    })

    let demotionToken = ''
    try {
      await updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 1,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(MatCountDemotionConfirmationRequiredError)
      demotionToken = (error as MatCountDemotionConfirmationRequiredError).demotionToken
    }

    const result = await updateBoutsPageSettings({
      draftId: draft.id,
      expectedVersion: draft.version,
      matCount: 1,
      confirmFixedDemotion: true,
      demotionToken,
    })
    expect(result.matCountChange?.demotedCategoryCount).toBe(1)
    const updated = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw.id } })
    expect(updated?.matIndex).toBeNull()
  })

  it('updates matIndex inside locked transaction using current matCount', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    const draw = await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test',
        drawSeed: 'seed',
        matIndex: null,
      },
    })

    const result = await updateBracketDrawMatIndex({
      drawId: draw.id,
      draftId: draft.id,
      expectedVersion: draft.version,
      matIndex: 2,
    })

    expect(result.draw.matIndex).toBe(2)
    const updated = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw.id } })
    expect(updated?.matIndex).toBe(2)
  })

  it('never ends with matCount=1 and matIndex=3 under concurrent matCount decrease and matIndex increase', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    const draw = await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test',
        drawSeed: 'seed',
        matIndex: 1,
      },
    })

    const results = await Promise.allSettled([
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 1,
      }),
      updateBracketDrawMatIndex({
        drawId: draw.id,
        draftId: draft.id,
        expectedVersion: draft.version,
        matIndex: 3,
      }),
    ])

    const rejected = results.filter((result) => result.status === 'rejected')
    expect(rejected.length).toBeGreaterThan(0)

    const settings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
    const updatedDraw = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw.id } })
    expect(settings?.matCount === 1 && updatedDraw?.matIndex === 3).toBe(false)
  })

  it('matCount PATCH first: parallel matIndex writer cannot write out-of-range Fixed', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      const prepared = await publishAutoAndFixedCategoryDraft(3)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.fixedKey,
        released: true,
        expectedPublishedDrawId: prepared.fixedDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const matCountResult = await updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matCount: 2,
        confirmFixedDemotion: true,
        demotionToken: (
          await (async () => {
            try {
              await updateBoutsPageSettings({
                draftId: prepared.draft.id,
                expectedVersion: prepared.draft.version,
                matCount: 2,
              })
            } catch (error) {
              return (error as MatCountDemotionConfirmationRequiredError).demotionToken
            }
            throw new Error('expected demotion')
          })()
        ),
      })
      expect(matCountResult.settings.matCount).toBe(2)
      if (!('draft' in matCountResult) || !matCountResult.draft) {
        throw new Error('expected draft version after mat count change')
      }

      const draftDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: prepared.draft.id, categoryKey: prepared.fixedKey },
      })
      expect(draftDraw).not.toBeNull()

      await expect(
        updateBracketDrawMatIndex({
          drawId: draftDraw!.id,
          draftId: prepared.draft.id,
          expectedVersion: matCountResult.draft.version,
          matIndex: 3,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_MAT_INDEX' })

      const publishedDraw = await prisma.bracketCategoryDraw.findUnique({
        where: { id: prepared.fixedDrawId },
      })
      expect(publishedDraw?.matIndex == null || publishedDraw.matIndex <= 2).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('keeps released categories when matCount decreases with in-range Fixed matIndex=2 (3→2)', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: prepared.fixedKey,
        released: true,
        expectedPublishedDrawId: prepared.fixedDrawId,
        expectedPublishedGenerationId: prepared.publishedGenerationId,
      })

      const result = await updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matCount: 2,
      })

      expect(result.matCountChange?.demotedCategoryCount).toBe(0)
      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.fixedKey },
      })
      expect(state?.boutsReleased).toBe(true)
      const publishedDraw = await prisma.bracketCategoryDraw.findUnique({
        where: { id: prepared.fixedDrawId },
      })
      expect(publishedDraw?.matIndex).toBe(2)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('happy path 2→3 recomputes released Auto without demotion confirmation', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await seedBoutsPageSetting({ matCount: 2 })
      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
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
        matCount: 3,
      })

      expect(result.matCountChange?.demotedCategoryCount).toBe(0)
      expect(result.matCountChange?.recomputedReleasedCategoryCount).toBe(1)
      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(state?.boutsReleased).toBe(true)
      expect(state?.matCountAtRelease).toBe(3)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('rejects confirmation without matCount change (Rule C)', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await expect(
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        confirmFixedDemotion: true,
        demotionToken: 'stale',
      }),
    ).rejects.toBeInstanceOf(BoutsValidationError)
  })

  it('rejects stale draft version with VersionConflictError', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await expect(
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version + 99,
        matCount: 2,
      }),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })

  it('does not unrelease categories when matCount decreases below released assignments after confirm', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      const prepared = await preparePublishableDraft()
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)
      generationIds.push(prepared.originalDraftId)

      const published = await publishBracketDraft({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
      })
      generationIds.push(published.publishedGenerationId, published.draft.id)

      const draw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
      })
      expect(draw).not.toBeNull()

      await prisma.bracketCategoryDraw.update({
        where: { id: draw!.id },
        data: { matIndex: 3 },
      })
      await prisma.bracketCategoryDraw.updateMany({
        where: { generationId: published.draft.id, categoryKey: draw!.categoryKey },
        data: { matIndex: 3 },
      })

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: draw!.categoryKey,
        released: true,
        expectedPublishedDrawId: draw!.id,
        expectedPublishedGenerationId: published.publishedGenerationId,
      })

      let state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: draw!.categoryKey },
      })
      expect(state?.boutsReleased).toBe(true)

      let demotionToken = ''
      try {
        await updateBoutsPageSettings({
          draftId: published.draft.id,
          expectedVersion: published.draft.version,
          matCount: 1,
        })
      } catch (error) {
        demotionToken = (error as MatCountDemotionConfirmationRequiredError).demotionToken
      }
      expect(demotionToken.length).toBeGreaterThan(0)

      await updateBoutsPageSettings({
        draftId: published.draft.id,
        expectedVersion: published.draft.version,
        matCount: 1,
        confirmFixedDemotion: true,
        demotionToken,
      })

      state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: draw!.categoryKey },
      })
      expect(state?.boutsReleased).toBe(true)
      expect(state?.matCountAtRelease).toBe(1)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('Order A: stale demotion token after matIndex writer changes draft plan', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      const prepared = await publishAutoAndFixedCategoryDraft(3)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      let staleToken = ''
      try {
        await updateBoutsPageSettings({
          draftId: prepared.draft.id,
          expectedVersion: prepared.draft.version,
          matCount: 2,
        })
      } catch (error) {
        staleToken = (error as MatCountDemotionConfirmationRequiredError).demotionToken
      }
      expect(staleToken.length).toBeGreaterThan(0)

      const draftDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: prepared.draft.id, categoryKey: prepared.fixedKey },
      })
      expect(draftDraw).not.toBeNull()

      const writerResult = await updateBracketDrawMatIndex({
        drawId: draftDraw!.id,
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matIndex: 2,
      })

      await expect(
        updateBoutsPageSettings({
          draftId: prepared.draft.id,
          expectedVersion: writerResult.draft.version,
          matCount: 2,
          confirmFixedDemotion: true,
          demotionToken: staleToken,
        }),
      ).rejects.toBeInstanceOf(MatCountDemotionConfirmationRequiredError)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('rejects stale demotion token when a new out-of-range category appears', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Test A',
        drawSeed: 'seed-a',
        matIndex: 3,
      },
    })

    let staleToken = ''
    try {
      await updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 2,
      })
    } catch (error) {
      staleToken = (error as MatCountDemotionConfirmationRequiredError).demotionToken
    }
    expect(staleToken.length).toBeGreaterThan(0)

    await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_B,
        discipline: 'tactic_control',
        title: 'Test B',
        drawSeed: 'seed-b',
        matIndex: 3,
      },
    })

    await expect(
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 2,
        confirmFixedDemotion: true,
        demotionToken: staleToken,
      }),
    ).rejects.toBeInstanceOf(MatCountDemotionConfirmationRequiredError)
  })

  it('demotes fixed category on live singleton when matIndex exceeds new matCount', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      const prepared = await publishAutoAndFixedCategoryDraft(2)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      const draftDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: prepared.draft.id, categoryKey: prepared.fixedKey },
      })
      expect(draftDraw).not.toBeNull()

      const writerResult = await updateBracketDrawMatIndex({
        drawId: draftDraw!.id,
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matIndex: 3,
      })

      let demotionError: MatCountDemotionConfirmationRequiredError | null = null
      try {
        await updateBoutsPageSettings({
          draftId: prepared.draft.id,
          expectedVersion: writerResult.draft.version,
          matCount: 2,
        })
      } catch (error) {
        demotionError = error as MatCountDemotionConfirmationRequiredError
      }

      expect(demotionError).not.toBeNull()
      expect(demotionError!.draftEntries).toHaveLength(1)
      expect(demotionError!.draftEntries[0]?.matIndex).toBe(3)
      expect(demotionError!.publishedEntries).toHaveLength(0)

      const confirmed = await updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: writerResult.draft.version,
        matCount: 2,
        confirmFixedDemotion: true,
        demotionToken: demotionError!.demotionToken,
      })
      expect(confirmed.matCountChange?.demotedCategoryCount).toBe(1)

      const publishedDraw = await prisma.bracketCategoryDraw.findUnique({
        where: { id: prepared.fixedDrawId },
      })
      expect(publishedDraw?.matIndex).toBeNull()
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('rejects wrong draftId with DraftConflictError', async () => {
    const draft = await createIsolatedDraft(BigInt(0))
    await expect(
      updateBoutsPageSettings({
        draftId: 'non-existent-draft-id',
        expectedVersion: draft.version,
        matCount: 2,
      }),
    ).rejects.toBeInstanceOf(DraftConflictError)
  })

  it('rejects confirmation when matCount equals locked current (Rule C)', async () => {
    await seedBoutsPageSetting({ matCount: 3 })
    const draft = await createIsolatedDraft(BigInt(0))
    await expect(
      updateBoutsPageSettings({
        draftId: draft.id,
        expectedVersion: draft.version,
        matCount: 3,
        confirmFixedDemotion: true,
        demotionToken: 'stale-token',
      }),
    ).rejects.toBeInstanceOf(BoutsValidationError)
  })

  it('concurrency release first: matCount PATCH and release serialize safely', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await seedBoutsPageSetting({ matCount: 3 })
      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
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
      const patchPromise = updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matCount: 2,
      })

      await Promise.all([releasePromise, patchPromise])

      const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: prepared.autoKey },
      })
      expect(settings.matCount).toBe(2)
      expect(state?.boutsReleased).toBe(true)
      expect(state?.matCountAtRelease).toBe(2)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })

  it('concurrency matCount PATCH first: release uses new matCount', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const generationIds: string[] = []
    const registrationIds: string[] = []
    const entryIds: string[] = []

    try {
      await seedBoutsPageSetting({ matCount: 3 })
      const prepared = await publishAutoAndFixedCategoryDraft(null)
      generationIds.push(prepared.publishedGenerationId, prepared.draft.id)
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)

      const patchPromise = updateBoutsPageSettings({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        matCount: 2,
      })
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
      expect(settings.matCount).toBe(2)
      expect(state?.boutsReleased).toBe(true)
      expect(state?.matCountAtRelease).toBe(2)
    } finally {
      vi.unstubAllEnvs()
      await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
      await resetRegistrationRevision()
    }
  })
})
