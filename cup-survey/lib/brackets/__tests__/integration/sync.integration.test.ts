import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { updateBracketFormatRules } from '../../service'
import { moveBracketEntry } from '../../placements'
import { syncBracketDraft } from '../../generation/sync'
import {
  CAT_A,
  CAT_B,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedTwoPaidEntriesDifferentClubs,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets sync integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('SYNC scope=all resets manual placements and category overrides', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)
    const [entryId] = seeded.entryIds

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: draft.version,
      scope: 'all',
    })

    await moveBracketEntry({
      draftId: draft.id,
      expectedVersion: 2,
      entryId,
      targetCategoryKey: CAT_B,
    })

    const drawBefore = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: draft.id, categoryKey: CAT_A },
    })
    await prisma.bracketCategoryDraw.update({
      where: { id: drawBefore!.id },
      data: { systemOverride: 'round_robin', bronzeModeOverride: 'ONE' },
    })

    const synced = await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: 3,
      scope: 'all',
    })

    const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })
    expect(placement).toBeNull()

    const inSourceDraw = await prisma.bracketDrawParticipant.findFirst({
      where: {
        entryId,
        draw: { generationId: draft.id, categoryKey: CAT_A },
      },
    })
    expect(inSourceDraw).not.toBeNull()

    const drawAfter = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: draft.id, categoryKey: CAT_A },
    })
    expect(drawAfter?.systemOverride).toBeNull()
    expect(drawAfter?.bronzeModeOverride).toBeNull()
    expect(synced.draft.version).toBeGreaterThan(3)
  })

  it('SYNC scope=all rejects wiping draft when no entries match eligibility', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: draft.version,
      scope: 'all',
    })

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { includePaid: false, includeUnpaid: false },
    })

    await expect(
      syncBracketDraft({
        draftId: draft.id,
        expectedVersion: 2,
        scope: 'all',
      }),
    ).rejects.toMatchObject({ code: 'NO_ELIGIBLE_ENTRIES' })

    const participants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: draft.id } },
    })
    expect(participants).toBeGreaterThan(0)
  })

  it('SYNC scope=all returns replaceCategories payload for dashboard cache', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const synced = await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: draft.version,
      scope: 'all',
    })

    expect(synced.replaceCategories).toBe(true)
    expect(synced.categories?.length).toBeGreaterThan(0)
    expect(synced.categories?.every((category) => category.participants.length > 0)).toBe(true)
  })

  it('SYNC preserves seed order and lock flags', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const synced = await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: draft.version,
      scope: 'all',
    })

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: draft.id, categoryKey: CAT_A },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(draw?.participants).toHaveLength(2)

    const [first, second] = draw!.participants
    const lockedEntryId = first.entryId
    await prisma.bracketDrawParticipant.update({
      where: { id: second.id },
      data: { seedPosition: 10 },
    })
    await prisma.bracketDrawParticipant.update({
      where: { id: first.id },
      data: { seedLocked: true, seedPosition: 2 },
    })
    await prisma.bracketDrawParticipant.update({
      where: { id: second.id },
      data: { seedPosition: 1 },
    })

    const resynced = await syncBracketDraft({
      draftId: draft.id,
      expectedVersion: synced.draft.version,
      scope: 'all',
    })

    const after = await prisma.bracketDrawParticipant.findMany({
      where: { drawId: draw!.id },
    })
    const locked = after.find((p) => p.entryId === lockedEntryId)
    expect(locked?.seedLocked).toBe(true)
    expect(locked?.seedPosition).toBe(2)
    expect(resynced.draft.version).toBeGreaterThan(synced.draft.version)
  })

  it('PATCH format-rules does not change composition fingerprints', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const ready = await syncRedrawAll(draft.id, draft.version)
    const before = await prisma.bracketGeneration.findUnique({
      where: { id: draft.id },
      include: { categories: true },
    })

    const rules = await prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
    await updateBracketFormatRules({
      draftId: draft.id,
      expectedVersion: ready.draft.version,
      rules: rules.map((r) => ({
        id: r.id,
        minParticipants: r.minParticipants,
        maxParticipants: r.maxParticipants,
        systemId: r.systemId,
        defaultBronzeMode: r.defaultBronzeMode,
        allowedSystemIds: r.allowedSystemIds,
        sortOrder: r.sortOrder,
        enabled: r.enabled,
      })),
    })

    const after = await prisma.bracketGeneration.findUnique({
      where: { id: draft.id },
      include: { categories: true },
    })

    expect(after!.sourceFingerprint).toBe(before!.sourceFingerprint)
    expect(after!.sourceRevision).toBe(before!.sourceRevision)
    for (const cat of before!.categories) {
      const updated = after!.categories.find((c) => c.categoryKey === cat.categoryKey)
      expect(updated?.sourceFingerprint).toBe(cat.sourceFingerprint)
      expect(updated?.seedingFingerprint).toBe(cat.seedingFingerprint)
    }
  })
})
