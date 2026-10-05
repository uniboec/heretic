import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { moveBracketEntry, resetBracketEntryPlacement } from '../../placements'
import {
  CAT_A,
  CAT_B,
  CAT_C,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  seedPaidEntry,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets move audit integration', () => {
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
  })

  it('records audit trail A→B→C and reset returns to source category', async () => {
    const { entryId, registrationId } = await seedPaidEntry('audit')
    entryIds.push(entryId)
    registrationIds.push(registrationId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await moveBracketEntry({
      draftId: draft.id,
      expectedVersion: 1,
      entryId,
      targetCategoryKey: CAT_B,
    })
    const afterB = await prisma.bracketGeneration.findUnique({ where: { id: draft.id } })
    const v2 = afterB!.version

    await moveBracketEntry({
      draftId: draft.id,
      expectedVersion: v2,
      entryId,
      targetCategoryKey: CAT_C,
    })
    const afterC = await prisma.bracketGeneration.findUnique({ where: { id: draft.id } })
    const v3 = afterC!.version

    const audit = await prisma.bracketMoveAudit.findMany({
      where: { entryId },
      orderBy: { movedAt: 'asc' },
    })
    expect(audit).toHaveLength(2)
    expect(audit[0]).toMatchObject({ action: 'MOVE', toCategoryKey: CAT_B })
    expect(audit[1]).toMatchObject({ action: 'MOVE', fromCategoryKey: CAT_B, toCategoryKey: CAT_C })

    await resetBracketEntryPlacement({
      draftId: draft.id,
      expectedVersion: v3,
      entryId,
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

    const resetAudit = await prisma.bracketMoveAudit.findMany({
      where: { entryId, action: 'RESET' },
    })
    expect(resetAudit[0]?.toCategoryKey).toBe(CAT_A)
  })

  it('rolls back move on invalid entry without version increment', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await expect(
      moveBracketEntry({
        draftId: draft.id,
        expectedVersion: 1,
        entryId: 'missing-entry',
        targetCategoryKey: CAT_B,
      }),
    ).rejects.toThrow()

    const unchanged = await prisma.bracketGeneration.findUnique({ where: { id: draft.id } })
    expect(unchanged?.version).toBe(1)
  })
})
