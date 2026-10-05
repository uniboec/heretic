import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { getAdminBracketCategoryStructure, getAdminLiveCategoryStructure } from '../../service'
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

describe('admin live structure integration', () => {
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

  it('live published structure reflects bout winners while draft preview stays unchanged', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    await publishSeededOlympicCategory({ seeded, generationIds })
    const [a1, , , a4] = seeded.entryIds
    const categoryKey = seeded.categoryKey

    const draftBefore = await getAdminBracketCategoryStructure(categoryKey)
    const liveBefore = await getAdminLiveCategoryStructure(categoryKey)
    expect(draftBefore?.structure?.rounds[0]?.winnerEntryId).toBeUndefined()
    expect(liveBefore?.structure?.rounds[0]?.winnerEntryId).toBeUndefined()

    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-1',
      winnerEntryId: a1,
      loserEntryId: a4,
    })

    const draftAfter = await getAdminBracketCategoryStructure(categoryKey)
    const liveAfter = await getAdminLiveCategoryStructure(categoryKey)

    expect(draftAfter?.structure?.rounds[0]?.winnerEntryId).toBeUndefined()
    expect(liveAfter?.structure?.rounds[0]?.winnerEntryId).toBe(a1)
    expect(liveAfter?.isLive).toBe(true)
    expect(liveAfter?.result?.status).toBe('in_progress')
  })
})
