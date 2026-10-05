import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { BracketOperationError } from '../../core/errors'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import { publishBracketDraft } from '../../generation/publish'
import { redrawBracketDraft } from '../../generation/redraw'
import { syncBracketDraft } from '../../generation/sync'
import { getPublicBrackets, updateBracketDraw } from '../../service'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
  seedPaidEntry,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('bracket publication state integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: false },
    })
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('allows visibility after sync without explicit publish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
    })

    const result = await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: true,
    })

    expect(result.visible).toBe(true)
    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw!.categoryKey },
    })
    expect(state?.visible).toBe(true)
    expect(state?.publishedDrawId).toBe(draw!.id)
  })

  it('shows all active categories on global visibility action', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const result = await setCategoriesPublicVisibility({
      scope: 'all',
      visible: true,
    })

    expect(result.affectedCategoryKeys.length).toBeGreaterThan(0)
    const visibleCount = await prisma.bracketPublicationState.count({
      where: { visible: true },
    })
    expect(visibleCount).toBe(result.affectedCategoryKeys.length)
  })

  it('resets visible and bouts release fields on republish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const firstPublish = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(firstPublish.publishedGenerationId, firstPublish.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: firstPublish.publishedGenerationId, status: 'ACTIVE' },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: publishedDraw!.categoryKey,
      visible: true,
    })

    const synced = await syncBracketDraft({
      draftId: firstPublish.draft.id,
      expectedVersion: firstPublish.draft.version,
      scope: 'all',
    })
    const redrawn = await redrawBracketDraft({
      draftId: synced.draft.id,
      expectedVersion: synced.draft.version,
      scope: 'all',
    })
    const secondPublish = await publishBracketDraft({
      draftId: redrawn.draft.id,
      expectedVersion: redrawn.draft.version,
    })
    generationIds.push(secondPublish.publishedGenerationId)

    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: publishedDraw!.categoryKey },
      include: { publishedDraw: true },
    })
    expect(state?.visible).toBe(false)
    expect(state?.boutsReleased).toBe(false)
    expect(state?.boutMatAssignments).toBeNull()
    expect(state?.matCountAtRelease).toBeNull()
    expect(state?.publishedDraw.generationId).toBe(secondPublish.publishedGenerationId)
  })

  it('deploys visible category content on publish N+1 after re-toggle', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const firstPublish = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(firstPublish.publishedGenerationId, firstPublish.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: firstPublish.publishedGenerationId, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: publishedDraw!.categoryKey,
      visible: true,
    })

    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: firstPublish.draft.id, categoryKey: publishedDraw!.categoryKey },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = draftDraw!.participants
    const swapped = await updateBracketDraw({
      drawId: draftDraw!.id,
      draftId: firstPublish.draft.id,
      expectedVersion: firstPublish.draft.version,
      participants: [
        { entryId: first.entryId, seedPosition: second.seedPosition, seedLocked: first.seedLocked },
        { entryId: second.entryId, seedPosition: first.seedPosition, seedLocked: second.seedLocked },
      ],
    })

    const secondPublish = await publishBracketDraft({
      draftId: swapped.draft.id,
      expectedVersion: swapped.draft.version,
    })
    generationIds.push(secondPublish.publishedGenerationId)

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: publishedDraw!.categoryKey,
      visible: true,
    })

    const publicData = await getPublicBrackets()
    expect(publicData).not.toBeNull()
    const category = publicData!.categories.find(
      (item) => item.categoryKey === publishedDraw!.categoryKey,
    )
    expect(category).toBeTruthy()
    expect(category!.participants[0]?.entryId).toBe(second.entryId)
  })

  it('resets visible when category disappears and reappears in publish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const firstPublish = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(firstPublish.publishedGenerationId, firstPublish.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: firstPublish.publishedGenerationId, status: 'ACTIVE' },
    })
    const categoryKey = publishedDraw!.categoryKey

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })

    await prisma.teamRegistration.deleteMany({
      where: { id: { in: prepared.registrationIds } },
    })
    registrationIds.length = 0
    entryIds.length = 0

    const syncedEmpty = await syncBracketDraft({
      draftId: firstPublish.draft.id,
      expectedVersion: firstPublish.draft.version,
      scope: 'all',
      afterRegistrationChange: true,
    })
    const emptyPublish = await publishBracketDraft({
      draftId: syncedEmpty.draft.id,
      expectedVersion: syncedEmpty.draft.version,
    })
    generationIds.push(emptyPublish.publishedGenerationId)

    const hiddenPublic = await getPublicBrackets()
    expect(hiddenPublic!.categories.some((item) => item.categoryKey === categoryKey)).toBe(false)

    const resetState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey },
    })
    expect(resetState?.visible ?? false).toBe(false)

    const reseeded = await seedPaidEntry('reappear')
    const reseededB = await seedPaidEntry('reappear-b')
    registrationIds.push(reseeded.registrationId, reseededB.registrationId)
    entryIds.push(reseeded.entryId, reseededB.entryId)

    const draft = await prisma.bracketGeneration.findFirst({
      where: { singletonKey: 'live' },
    })
    const ready = await syncRedrawAll(draft!.id, draft!.version)
    const restoredPublish = await publishBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(restoredPublish.publishedGenerationId)

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })

    const publicData = await getPublicBrackets()
    expect(publicData!.categories.some((item) => item.categoryKey === categoryKey)).toBe(true)
  })

  it('preserves visibility intent when publish races with visibility toggle', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const firstPublish = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(firstPublish.publishedGenerationId, firstPublish.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: firstPublish.publishedGenerationId, status: 'ACTIVE' },
    })
    const categoryKey = publishedDraw!.categoryKey

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey,
      visible: true,
    })

    const synced = await syncBracketDraft({
      draftId: firstPublish.draft.id,
      expectedVersion: firstPublish.draft.version,
      scope: 'all',
    })
    const redrawn = await redrawBracketDraft({
      draftId: synced.draft.id,
      expectedVersion: synced.draft.version,
      scope: 'all',
    })

    const [visibilityResult, publishResult] = await Promise.all([
      setCategoriesPublicVisibility({
        scope: 'category',
        categoryKey,
        visible: false,
      }),
      publishBracketDraft({
        draftId: redrawn.draft.id,
        expectedVersion: redrawn.draft.version,
      }),
    ])
    generationIds.push(publishResult.publishedGenerationId)

    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey },
      include: { publishedDraw: true },
    })
    expect(state?.visible).toBe(false)
    expect(state?.publishedDraw.generationId).toBe(publishResult.publishedGenerationId)
    expect(visibilityResult.visible).toBe(false)
  })
})
