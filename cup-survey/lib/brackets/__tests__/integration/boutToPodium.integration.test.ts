import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { deserializePublishedStructure } from '../../core/snapshot'
import { readCategoryResult } from '../../core/readCategoryResult'
import {
  applyIntegrationBoutResult,
  cleanupBracketIntegrationData,
  ensureBracketDefaults,
  publishSeededOlympicCategory,
  purgeBracketIntegrationState,
  purgeMatControlTables,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('bout to podium integration', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  beforeEach(async () => {
    if (!dbAvailable) return
    await purgeBracketIntegrationState()
    await ensureBracketDefaults()
    await seedBoutsPageSetting()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await purgeMatControlTables()
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
  })

  it('completes a four-athlete olympic category with podium placements', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const { publishedDraw } = await publishSeededOlympicCategory({ seeded, generationIds })
    const [a1, a2, a3, a4] = seeded.entryIds
    const categoryKey = seeded.categoryKey

    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-1',
      winnerEntryId: a1,
      loserEntryId: a4,
    })
    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-2',
      winnerEntryId: a2,
      loserEntryId: a3,
    })
    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-3',
      winnerEntryId: a1,
      loserEntryId: a2,
      schedulePhase: 'final',
    })
    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bronze-fight',
      winnerEntryId: a4,
      loserEntryId: a3,
      schedulePhase: 'bronze',
    })

    const draw = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const snapshot = deserializePublishedStructure(draw?.publishedStructureJson)
    const result = readCategoryResult(snapshot?.structure ?? null)

    expect(result?.status).toBe('complete')
    expect(result?.placements).toEqual([
      { entryId: a1, placement: 1, reason: 'FINAL_WINNER' },
      { entryId: a2, placement: 2, reason: 'FINAL_LOSER' },
      { entryId: a4, placement: 3, reason: 'BRONZE_WINNER' },
    ])
  })
})
