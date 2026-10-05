import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { BracketOperationError, VersionConflictError } from '../../core/errors'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import { publishBracketDraft } from '../../generation/publish'
import { getPublicBrackets, updateBracketDraw } from '../../service'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('updateBracketDraw integration', () => {
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

  it('manual swap recomputes fingerprint and allows publish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(draw).toBeTruthy()
    const [first, second] = draw!.participants
    expect(first.seedPosition).not.toBe(second.seedPosition)

    const swapped = await updateBracketDraw({
      drawId: draw!.id,
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      participants: [
        { entryId: first.entryId, seedPosition: second.seedPosition },
        { entryId: second.entryId, seedPosition: first.seedPosition },
      ],
    })

    const updatedDraw = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw!.id } })
    expect(updatedDraw?.seedingFingerprint).toBeTruthy()
    expect(updatedDraw?.drawInputFingerprint).toBeTruthy()

    expect(swapped.balanceDelta).toBeTruthy()
    expect(swapped.balanceDelta?.lines.length).toBeGreaterThanOrEqual(0)

    const published = await publishBracketDraft({
      draftId: swapped.draft.id,
      expectedVersion: swapped.draft.version,
    })
    generationIds.push(published.draft.id, published.publishedGenerationId)
    expect(published.ok).toBe(true)
  })

  it('reflects manual seed swap on public brackets without republish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(draw).toBeTruthy()

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: true,
    })

    const [first, second] = draw!.participants
    await updateBracketDraw({
      drawId: draw!.id,
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      participants: [
        { entryId: first.entryId, seedPosition: second.seedPosition },
        { entryId: second.entryId, seedPosition: first.seedPosition },
      ],
    })

    const updatedDraw = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw!.id } })
    expect(updatedDraw?.publishedStructureJson).toBeTruthy()

    const publicData = await getPublicBrackets()
    const category = publicData!.categories.find((item) => item.categoryKey === draw!.categoryKey)
    expect(category).toBeTruthy()
    expect(category!.participants[0]?.entryId).toBe(second.entryId)
    expect(category!.participants[1]?.entryId).toBe(first.entryId)
  })

  it('rejects moving locked participant', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = draw!.participants
    await prisma.bracketDrawParticipant.update({
      where: { id: first.id },
      data: { seedLocked: true },
    })

    await expect(
      updateBracketDraw({
        drawId: draw!.id,
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
        participants: [
          { entryId: first.entryId, seedPosition: second.seedPosition },
          { entryId: second.entryId, seedPosition: first.seedPosition },
        ],
      }),
    ).rejects.toBeInstanceOf(BracketOperationError)
  })

  it('rejects draw update with stale expectedVersion after publish', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const published = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(published.draft.id, published.publishedGenerationId)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = publishedDraw!.participants

    await expect(
      updateBracketDraw({
        drawId: publishedDraw!.id,
        draftId: published.publishedGenerationId,
        expectedVersion: prepared.draft.version,
        participants: [
          { entryId: first.entryId, seedPosition: second.seedPosition },
          { entryId: second.entryId, seedPosition: first.seedPosition },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' })
  })

  it('rejects stale expectedVersion', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = draw!.participants

    await expect(
      updateBracketDraw({
        drawId: draw!.id,
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version - 1,
        participants: [
          { entryId: first.entryId, seedPosition: second.seedPosition },
          { entryId: second.entryId, seedPosition: first.seedPosition },
        ],
      }),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })
})
