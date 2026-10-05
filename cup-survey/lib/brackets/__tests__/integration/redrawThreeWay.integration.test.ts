import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { redrawBracketDraft } from '../../generation/redraw'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  resetRegistrationRevision,
  seedThreePaidEntriesSameCategory,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('three_way redraw dispatch integration', () => {
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

  it('uses legacy three_way redraw path without olympic draw balance report', async () => {
    await ensureBracketDefaults()
    const seeded = await seedThreePaidEntriesSameCategory()
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(draw).toBeTruthy()
    await prisma.bracketCategoryDraw.update({
      where: { id: draw!.id },
      data: { systemOverride: 'three_way' },
    })
    expect(draw!.participants).toHaveLength(3)

    const beforePositions = draw!.participants.map((participant) => participant.seedPosition)
    const redrawn = await redrawBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      scope: 'category',
      categoryKey: draw!.categoryKey,
    })

    expect(redrawn.drawBalanceReport).toBeUndefined()
    expect(redrawn.drawBalanceReports?.[draw!.categoryKey]).toBeUndefined()

    const afterDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { id: draw!.id },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    expect(afterDraw!.redrawRevision).toBeGreaterThan(draw!.redrawRevision)
    const afterPositions = afterDraw!.participants.map((participant) => participant.seedPosition)
    expect(afterPositions.sort()).toEqual(beforePositions.sort())
  })
})
