import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { moveBracketEntry } from '../../placements'
import {
  CAT_A,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedTwoPaidEntriesDifferentClubs,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets move rollback integration', () => {
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

  it('rolls back when move-entry target entry is not eligible', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const beforeParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: draft.id } },
    })
    const beforePlacements = await prisma.bracketEntryPlacement.count()

    await expect(
      moveBracketEntry({
        draftId: draft.id,
        expectedVersion: ready.draft.version,
        entryId: '00000000-0000-0000-0000-000000000000',
        targetCategoryKey: CAT_A,
      }),
    ).rejects.toThrow('Участник не найден или не подходит по критериям')

    const afterParticipants = await prisma.bracketDrawParticipant.count({
      where: { draw: { generationId: draft.id } },
    })
    const afterPlacements = await prisma.bracketEntryPlacement.count()
    const draftAfter = await prisma.bracketGeneration.findUnique({ where: { id: draft.id } })

    expect(afterParticipants).toBe(beforeParticipants)
    expect(afterPlacements).toBe(beforePlacements)
    expect(draftAfter?.version).toBe(ready.draft.version)
  })
})
