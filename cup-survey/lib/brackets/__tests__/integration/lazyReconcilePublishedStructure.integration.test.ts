import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { deserializePublishedStructure } from '../../core/snapshot'
import { getPublicBrackets } from '../../service'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import {
  cleanupBracketIntegrationData,
  createIntegrationBoutResult,
  ensureBracketDefaults,
  publishSeededOlympicCategory,
  purgeBracketIntegrationState,
  purgeMatControlTables,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('lazy reconcile published structure integration', () => {
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

  it('getPublicBrackets lazily replays BoutResult into stale published JSON', async () => {
    await prisma.bracketPageSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', publicEnabled: true, includePaid: true, includeUnpaid: false },
      update: { publicEnabled: true },
    })

    const seeded = await seedCategoryWithAthletes({
      participantCount: 2,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const { published, publishedDraw } = await publishSeededOlympicCategory({
      seeded,
      generationIds,
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: seeded.categoryKey,
      visible: true,
      expectedPublishedDrawId: publishedDraw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })

    const [redEntryId, blueEntryId] = seeded.entryIds
    const boutId = `${seeded.categoryKey}::bout-1`
    await createIntegrationBoutResult({
      boutId,
      winnerEntryId: redEntryId,
      loserEntryId: blueEntryId,
    })

    const publicData = await getPublicBrackets()
    const category = publicData?.categories.find(
      (item) => item.categoryKey === seeded.categoryKey,
    )
    expect(category?.structure?.rounds[0]?.winnerEntryId).toBe(redEntryId)

    const stored = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const snapshot = deserializePublishedStructure(stored?.publishedStructureJson)
    expect(snapshot?.structure.rounds[0]?.winnerEntryId).toBe(redEntryId)
  })
})
