import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex } from '../mutations'
import { deserializePublishedStructure } from '../../brackets/core/snapshot'
import { applyBoutResultToCompetitionStructure } from '../../brackets/applyBoutResultToCompetitionStructure'
import { TOURNAMENT_SCOPE_ID } from '../../config/tournament'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  purgeMatControlTables,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  syncRedrawAll,
} from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'

describe('parallel category confirm integration', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  beforeEach(async () => {
    if (!dbAvailable) return
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
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

  it('parallel structure patches for two semifinals preserve both winners', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    if (!draw) throw new Error('draw missing')

    const matUpdate = await updateBracketDrawMatIndex({
      drawId: draw.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      matIndex: 1,
    })

    const published = await publishBracketDraft({
      draftId: matUpdate.draft.id,
      expectedVersion: matUpdate.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    const bout1Id = `${seeded.categoryKey}::bout-1`
    const bout2Id = `${seeded.categoryKey}::bout-2`
    const [a1, a2, a3, a4] = seeded.entryIds

    await prisma.boutResult.create({
      data: {
        boutId: bout1Id,
        resultVersion: 1,
        isCurrent: true,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        winnerEntryId: a1,
        loserEntryId: a2,
        victoryMethod: 'POINTS',
        decisionReason: 'test',
        decidedInPeriod: 'main',
        mainRedScore: 4,
        mainBlueScore: 0,
        officialEndedAt: new Date(),
        resultConfirmedAt: new Date(),
        attemptNumber: 1,
        resultStatus: 'ACTIVE',
      },
    })
    await prisma.boutResult.create({
      data: {
        boutId: bout2Id,
        resultVersion: 1,
        isCurrent: true,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        winnerEntryId: a4,
        loserEntryId: a3,
        victoryMethod: 'POINTS',
        decisionReason: 'test',
        decidedInPeriod: 'main',
        mainRedScore: 0,
        mainBlueScore: 4,
        officialEndedAt: new Date(),
        resultConfirmedAt: new Date(),
        attemptNumber: 1,
        resultStatus: 'ACTIVE',
      },
    })

    await Promise.all([
      prisma.$transaction((tx) =>
        applyBoutResultToCompetitionStructure(tx, {
          boutId: bout1Id,
          categoryKey: seeded.categoryKey,
          winnerEntryId: a1,
          loserEntryId: a2,
          schedulePhase: 'elimination',
        }),
      ),
      prisma.$transaction((tx) =>
        applyBoutResultToCompetitionStructure(tx, {
          boutId: bout2Id,
          categoryKey: seeded.categoryKey,
          winnerEntryId: a4,
          loserEntryId: a3,
          schedulePhase: 'elimination',
        }),
      ),
    ])

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, categoryKey: seeded.categoryKey },
    })
    const snapshot = deserializePublishedStructure(publishedDraw?.publishedStructureJson)
    const round1 = snapshot?.structure.rounds.filter((match) => match.round === 1) ?? []
    const winners = round1.map((match) => match.winnerEntryId)

    expect(winners).toContain(a1)
    expect(winners).toContain(a4)
  })
})
