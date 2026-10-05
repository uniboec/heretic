import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { deserializePublishedStructure } from '../../core/snapshot'
import { readCategoryResult } from '../../core/readCategoryResult'
import { applyBoutResultCorrection } from '../../../bouts/applyBoutResultCorrection'
import { extractBouts } from '../../../bouts/extractBouts'
import { resolveDownstreamBoutIds } from '../../../bouts/sportDependencies'
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

describe('correction placements integration', () => {
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

  it('early branch correction keeps in_progress until category is replayed to complete', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const { publishedDraw } = await publishSeededOlympicCategory({ seeded, generationIds })
    const [a1, a2, a3, a4] = seeded.entryIds
    const categoryKey = seeded.categoryKey
    const bout1Id = `${categoryKey}::bout-1`

    const initialSnapshot = deserializePublishedStructure(publishedDraw.publishedStructureJson)
    const initialBouts = extractBouts(initialSnapshot!.structure, {
      categoryKey,
      categoryTitle: publishedDraw.categoryTitle,
      discipline: publishedDraw.discipline,
      storedMatIndex: publishedDraw.matIndex,
      competitionStage: publishedDraw.competitionStage,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(bout1Id, initialBouts)
    expect(downstreamBoutIds.length).toBeGreaterThan(0)

    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-1',
      winnerEntryId: a1,
      loserEntryId: a4,
    })

    const afterSemi1 = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const snapshotAfterSemi1 = deserializePublishedStructure(afterSemi1?.publishedStructureJson)
    expect(readCategoryResult(snapshotAfterSemi1?.structure ?? null)?.status).toBe('in_progress')

    await applyBoutResultCorrection({
      boutId: bout1Id,
      operationId: 'corr-branch-semi1',
      reason: 'Пересмотр полуфинала',
      requestedBy: 'admin',
      newWinnerEntryId: a4,
      newLoserEntryId: a1,
      systemId: 'olympic',
      categoryKey,
      schedulePhase: 'elimination',
      downstreamBoutIds,
    })

    const afterCorrection = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const snapshotAfterCorrection = deserializePublishedStructure(afterCorrection?.publishedStructureJson)
    expect(readCategoryResult(snapshotAfterCorrection?.structure ?? null)?.status).toBe('in_progress')

    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-2',
      winnerEntryId: a2,
      loserEntryId: a3,
    })
    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bout-3',
      winnerEntryId: a4,
      loserEntryId: a2,
      schedulePhase: 'final',
    })
    await applyIntegrationBoutResult({
      categoryKey,
      localBoutId: 'bronze-fight',
      winnerEntryId: a1,
      loserEntryId: a3,
      schedulePhase: 'bronze',
    })

    const afterComplete = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const finalSnapshot = deserializePublishedStructure(afterComplete?.publishedStructureJson)
    const result = readCategoryResult(finalSnapshot?.structure ?? null)
    expect(result?.status).toBe('complete')
    expect(result?.placements.map((placement) => placement.entryId)).toEqual([a4, a2, a1])
  })

  it('final correction swaps podium on a complete category', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const { publishedDraw } = await publishSeededOlympicCategory({ seeded, generationIds })
    const [a1, a2, a3, a4] = seeded.entryIds
    const categoryKey = seeded.categoryKey
    const finalBoutId = `${categoryKey}::bout-3`

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

    const beforeCorrection = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const beforeSnapshot = deserializePublishedStructure(beforeCorrection?.publishedStructureJson)
    expect(readCategoryResult(beforeSnapshot?.structure ?? null)?.status).toBe('complete')
    expect(
      readCategoryResult(beforeSnapshot?.structure ?? null)?.placements.map(
        (placement) => placement.entryId,
      ),
    ).toEqual([a1, a2, a4])

    await applyBoutResultCorrection({
      boutId: finalBoutId,
      operationId: 'corr-final-swap',
      reason: 'Пересмотр финала',
      requestedBy: 'admin',
      newWinnerEntryId: a2,
      newLoserEntryId: a1,
      systemId: 'olympic',
      categoryKey,
      schedulePhase: 'final',
      downstreamBoutIds: [],
    })

    const afterCorrection = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const afterSnapshot = deserializePublishedStructure(afterCorrection?.publishedStructureJson)
    const result = readCategoryResult(afterSnapshot?.structure ?? null)
    expect(result?.status).toBe('complete')
    expect(result?.placements.map((placement) => placement.entryId)).toEqual([a2, a1, a4])
  })

  it('branch correction after full completion resets podium to in_progress', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const { publishedDraw } = await publishSeededOlympicCategory({ seeded, generationIds })
    const [a1, a2, a3, a4] = seeded.entryIds
    const categoryKey = seeded.categoryKey
    const bout1Id = `${categoryKey}::bout-1`

    const initialSnapshot = deserializePublishedStructure(publishedDraw.publishedStructureJson)
    const initialBouts = extractBouts(initialSnapshot!.structure, {
      categoryKey,
      categoryTitle: publishedDraw.categoryTitle,
      discipline: publishedDraw.discipline,
      storedMatIndex: publishedDraw.matIndex,
      competitionStage: publishedDraw.competitionStage,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(bout1Id, initialBouts)

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

    const completeDraw = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    expect(
      readCategoryResult(
        deserializePublishedStructure(completeDraw?.publishedStructureJson)?.structure ?? null,
      )?.status,
    ).toBe('complete')

    await applyBoutResultCorrection({
      boutId: bout1Id,
      operationId: 'corr-after-complete',
      reason: 'Пересмотр после завершения категории',
      requestedBy: 'admin',
      newWinnerEntryId: a4,
      newLoserEntryId: a1,
      systemId: 'olympic',
      categoryKey,
      schedulePhase: 'elimination',
      downstreamBoutIds,
    })

    const afterCorrection = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    expect(
      readCategoryResult(
        deserializePublishedStructure(afterCorrection?.publishedStructureJson)?.structure ?? null,
      )?.status,
    ).toBe('in_progress')
  })
})
