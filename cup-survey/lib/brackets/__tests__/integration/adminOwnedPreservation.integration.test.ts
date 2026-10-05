import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { updateBracketDrawMatIndex } from '../../../bouts/mutations'
import { bumpRegistrationRevision } from '../../../registration/revision'
import { updateBracketDraw } from '../../service'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedPaidEntry,
  syncRedrawAll,
  seedThreePaidEntriesSameCategory,
  seedPaidPairInCategory,
  ensureBracketDefaults,
  seedBoutsPageSetting,
  CAT_A,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('admin-owned draw preservation on full registration sync', () => {
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

  it('preserves overrides, draw policy, matIndex, locked seeds, and placements after full sync', async () => {
    const seeded = await seedThreePaidEntriesSameCategory()
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft(BigInt(0))
    generationIds.push(draft.id)

    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const threeWayDraw = await prisma.bracketCategoryDraw.findFirst({
      where: {
        generationId: ready.draft.id,
        status: 'ACTIVE',
      },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(threeWayDraw).toBeTruthy()

    await seedBoutsPageSetting()

    const [first, second, third] = threeWayDraw!.participants
    const configured = await updateBracketDraw({
      drawId: threeWayDraw!.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      systemOverride: 'three_way',
      bronzeModeOverride: null,
      participants: [
        { entryId: first.entryId, seedPosition: first.seedPosition, seedLocked: true },
        { entryId: second.entryId, seedPosition: second.seedPosition, seedLocked: false },
        { entryId: third.entryId, seedPosition: third.seedPosition, seedLocked: false },
      ],
    })

    const matConfigured = await updateBracketDrawMatIndex({
      drawId: threeWayDraw!.id,
      draftId: configured.draft.id,
      expectedVersion: configured.draft.version,
      matIndex: 2,
    })

    await prisma.bracketCategoryDraw.update({
      where: { id: threeWayDraw!.id },
      data: {
        drawPolicyId: 'preservation-policy',
        drawPolicyVersion: 11,
      },
    })

    await prisma.bracketEntryPlacement.create({
      data: {
        entryId: first.entryId,
        categoryKey: threeWayDraw!.categoryKey,
        isManualMove: true,
      },
    })

    await bumpRegistrationRevision()

    const after = await prisma.bracketCategoryDraw.findUnique({
      where: { id: threeWayDraw!.id },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })

    expect(after?.systemOverride).toBe('three_way')
    expect(after?.matIndex).toBe(2)
    expect(after?.drawPolicyId).toBe('preservation-policy')
    expect(after?.drawPolicyVersion).toBe(11)
    expect(after?.participants.find((participant) => participant.entryId === first.entryId)?.seedLocked).toBe(
      true,
    )

    const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId: first.entryId } })
    expect(placement?.isManualMove).toBe(true)
    expect(placement?.categoryKey).toBe(threeWayDraw!.categoryKey)

    const draftGeneration = await prisma.bracketGeneration.findUnique({ where: { id: matConfigured.draft.id } })
    expect(draftGeneration?.sourceRevision).toBe(BigInt(1))
  })

  it('preserves admin-owned fields when a new paid athlete enters the category', async () => {
    await ensureBracketDefaults()
    const seededA = await seedPaidPairInCategory('w_66', 'preservation-a')
    const seededB = await seedPaidPairInCategory('w_66', 'preservation-b')
    registrationIds.push(seededA.registrationId, seededB.registrationId)
    entryIds.push(...seededA.entryIds, ...seededB.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: CAT_A, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(draw).toBeTruthy()
    expect(draw!.participants).toHaveLength(4)

    await seedBoutsPageSetting()

    const [first, second, third, fourth] = draw!.participants
    const configured = await updateBracketDraw({
      drawId: draw!.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      bronzeModeOverride: 'TWO',
      participants: [
        { entryId: first.entryId, seedPosition: first.seedPosition, seedLocked: true },
        { entryId: second.entryId, seedPosition: second.seedPosition, seedLocked: false },
        { entryId: third.entryId, seedPosition: third.seedPosition, seedLocked: false },
        { entryId: fourth.entryId, seedPosition: fourth.seedPosition, seedLocked: false },
      ],
    })

    const matConfigured = await updateBracketDrawMatIndex({
      drawId: draw!.id,
      draftId: configured.draft.id,
      expectedVersion: configured.draft.version,
      matIndex: null,
    })

    await prisma.bracketCategoryDraw.update({
      where: { id: draw!.id },
      data: {
        drawPolicyId: 'preservation-policy-2',
        drawPolicyVersion: 5,
      },
    })

    const added = await seedPaidEntry('preservation')
    registrationIds.push(added.registrationId)
    entryIds.push(added.entryId)

    await bumpRegistrationRevision()

    const after = await prisma.bracketCategoryDraw.findFirst({
      where: { id: draw!.id },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })

    expect(after?.bronzeModeOverride).toBe('TWO')
    expect(after?.matIndex).toBeNull()
    expect(after?.drawPolicyId).toBe('preservation-policy-2')
    expect(after?.drawPolicyVersion).toBe(5)
    expect(after?.participants.some((participant) => participant.entryId === added.entryId)).toBe(true)
    expect(after?.participants.find((participant) => participant.entryId === first.entryId)?.seedLocked).toBe(
      true,
    )

    const draftGeneration = await prisma.bracketGeneration.findUnique({ where: { id: matConfigured.draft.id } })
    expect(draftGeneration?.sourceRevision).toBe(BigInt(1))
    expect(after?.participants).toHaveLength(5)
  })
})
