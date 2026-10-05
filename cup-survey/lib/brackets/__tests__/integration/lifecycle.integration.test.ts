/**
 * E0 — black-box characterization: sync → redraw → publish → visibility → public read.
 * Documents operator-visible behavior before larger refactors (P, H, …).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { getPublicBrackets } from '../../service'
import { publishBracketDraft } from '../../generation/publish'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('E0 bracket lifecycle characterization', () => {
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

  it('sync → redraw → publish → visibility → public brackets', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
      include: { participants: true },
    })
    expect(draftDraw).toBeTruthy()
    expect(draftDraw!.seedingFingerprint).toBeTruthy()
    expect(draftDraw!.participants.length).toBeGreaterThanOrEqual(2)

    const published = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(published.draft.id, published.publishedGenerationId)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })
    expect(publishedDraw).toBeTruthy()

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    const visibility = await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: publishedDraw!.categoryKey,
      visible: true,
    })
    expect(visibility.publicationStates.some((state) => state.visible)).toBe(true)

    const publicData = await getPublicBrackets()
    expect(publicData).not.toBeNull()
    expect(publicData!.categories.length).toBeGreaterThanOrEqual(1)
    expect(publicData!.categories.some((c) => c.categoryKey === publishedDraw!.categoryKey)).toBe(
      true,
    )
  })

  it('redraw after sync changes seeding fingerprint', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const before = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
    })
    const redrawn = await syncRedrawAll(prepared.draft.id, prepared.draft.version)
    const after = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: redrawn.draft.id, status: 'ACTIVE' },
    })
    expect(after!.redrawRevision).toBeGreaterThan(before!.redrawRevision)
    expect(after!.seedingFingerprint).toBeTruthy()
  })
})
