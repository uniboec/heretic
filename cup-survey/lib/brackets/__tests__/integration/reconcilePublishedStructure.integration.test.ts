import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { publishBracketDraft } from '../../generation/publish'
import { updateBracketDrawMatIndex } from '../../../bouts/mutations'
import { deserializePublishedStructure, serializePublishedStructure } from '../../core/snapshot'
import { reconcileCategoryPublishedStructure } from '../../reconcilePublishedStructure'
import { TOURNAMENT_SCOPE_ID } from '../../../config/tournament'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  purgeMatControlTables,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('reconcilePublishedStructure integration', () => {
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

  it('replays existing BoutResult into structure stripped of winner fields', async () => {
    const seeded = await seedCategoryWithAthletes({
      participantCount: 2,
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

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, categoryKey: seeded.categoryKey },
    })
    if (!publishedDraw) throw new Error('published draw missing')

    const boutId = `${seeded.categoryKey}::bout-1`
    const [redEntryId, blueEntryId] = seeded.entryIds

    await prisma.boutResult.create({
      data: {
        boutId,
        resultVersion: 1,
        isCurrent: true,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        winnerEntryId: redEntryId,
        loserEntryId: blueEntryId,
        victoryMethod: 'POINTS',
        decisionReason: 'integration test',
        decidedInPeriod: 'main',
        mainRedScore: 4,
        mainBlueScore: 0,
        officialEndedAt: new Date(),
        resultConfirmedAt: new Date(),
        attemptNumber: 1,
        resultStatus: 'ACTIVE',
      },
    })

    const outcome = await prisma.$transaction((tx) =>
      reconcileCategoryPublishedStructure(tx, seeded.categoryKey),
    )

    expect(outcome.reconciled).toBe(true)
    expect(outcome.boutCount).toBe(1)

    const after = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const snapshot = deserializePublishedStructure(after?.publishedStructureJson)
    expect(snapshot?.structure.rounds[0]?.winnerEntryId).toBe(redEntryId)
    expect(snapshot?.structure.result?.status).toBe('complete')

    const stripped = {
      ...snapshot!.structure,
      rounds: snapshot!.structure.rounds.map((match) => ({
        ...match,
        winnerEntryId: undefined,
        loserEntryId: undefined,
      })),
      result: undefined,
    }

    await prisma.bracketCategoryDraw.update({
      where: { id: publishedDraw.id },
      data: {
        publishedStructureJson: serializePublishedStructure({
          systemId: snapshot!.systemId,
          systemVersion: snapshot!.systemVersion,
          structure: stripped,
        }),
      },
    })

    const replay = await prisma.$transaction((tx) =>
      reconcileCategoryPublishedStructure(tx, seeded.categoryKey),
    )
    expect(replay.reconciled).toBe(true)

    const replayed = await prisma.bracketCategoryDraw.findUnique({
      where: { id: publishedDraw.id },
    })
    const replayedSnapshot = deserializePublishedStructure(replayed?.publishedStructureJson)
    expect(replayedSnapshot?.structure.rounds[0]?.winnerEntryId).toBe(redEntryId)
  })
})
