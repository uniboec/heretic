import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { extractPlayableBoutsForPair } from '../../../bouts/extractForPair'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { updateBracketDrawMatIndex } from '../../../bouts/mutations'
import { moveBracketEntry } from '../../placements'
import { redrawBracketDraft } from '../../generation/redraw'
import { updateBracketDraw } from '../../service'
import { forceRebuildCategories } from '../../live/forceRebuild'
import { BRACKET_MUTATION_TX_OPTIONS } from '../../core/transactionOptions'
import {
  STRESS_CATEGORY_SIZES,
  STRESS_LARGE_CATEGORY_SIZES,
  cleanupBracketIntegrationData,
  collectDrawConsistencyIssues,
  createIsolatedDraft,
  ensureBracketDefaults,
  expectedAutoSystemForCount,
  publishActiveForIntegration,
  resetRegistrationRevision,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  seedStressMatrixCategorySizes,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('bracket stress matrix integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  async function prepareMatrixDraft(sizes: readonly number[]) {
    await ensureBracketDefaults()
    await seedBoutsPageSetting()
    const matrix = await seedStressMatrixCategorySizes(sizes)
    registrationIds.push(...matrix.registrationIds)
    entryIds.push(...matrix.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    return { matrix, draft: ready.draft }
  }

  it.each(STRESS_CATEGORY_SIZES.map((size) => [size] as const))(
    'syncs category with %i athletes across multiple clubs',
    async (participantCount) => {
      await ensureBracketDefaults()
      const seeded = await seedCategoryWithAthletes({ participantCount })
      registrationIds.push(...seeded.registrationIds)
      entryIds.push(...seeded.entryIds)

      const draft = await createIsolatedDraft()
      generationIds.push(draft.id)
      const ready = await syncRedrawAll(draft.id, draft.version)
      generationIds.push(ready.draft.id)

      const draw = await prisma.bracketCategoryDraw.findFirst({
        where: {
          generationId: ready.draft.id,
          categoryKey: seeded.categoryKey,
          status: 'ACTIVE',
        },
        include: { participants: true },
      })

      expect(draw).toBeTruthy()
      expect(draw!.participants).toHaveLength(participantCount)
      expect(draw!.autoSystemId).toBe(expectedAutoSystemForCount(participantCount))
      expect(await collectDrawConsistencyIssues(ready.draft.id)).toEqual([])
    },
    90_000,
  )

  it(
    'builds consistent draws for fast stress matrix (51 athletes, 9 categories)',
    async () => {
      const { matrix, draft } = await prepareMatrixDraft(STRESS_CATEGORY_SIZES)

      for (const category of matrix.categories) {
        const draw = await prisma.bracketCategoryDraw.findFirst({
          where: {
            generationId: draft.id,
            categoryKey: category.categoryKey,
            status: 'ACTIVE',
          },
          include: { participants: true },
        })
        expect(draw, `missing draw for ${category.categoryKey}`).toBeTruthy()
        expect(draw!.participants).toHaveLength(category.participantCount)
        expect(draw!.autoSystemId).toBe(expectedAutoSystemForCount(category.participantCount))
      }

      expect(await collectDrawConsistencyIssues(draft.id)).toEqual([])
    },
    180_000,
  )

  for (const participantCount of STRESS_LARGE_CATEGORY_SIZES) {
    const timeoutMs = participantCount >= 32 ? 600_000 : 240_000

    it(
      `syncs large olympic category with ${participantCount} athletes`,
      async () => {
        await ensureBracketDefaults()
        const seeded = await seedCategoryWithAthletes({ participantCount })
        registrationIds.push(...seeded.registrationIds)
        entryIds.push(...seeded.entryIds)

        const draft = await createIsolatedDraft()
        generationIds.push(draft.id)
        const ready = await syncRedrawAll(draft.id, draft.version)
        generationIds.push(ready.draft.id)

        const draw = await prisma.bracketCategoryDraw.findFirst({
          where: {
            generationId: ready.draft.id,
            categoryKey: seeded.categoryKey,
            status: 'ACTIVE',
          },
          include: { participants: true },
        })

        expect(draw?.participants).toHaveLength(participantCount)
        expect(draw?.autoSystemId).toBe('olympic')
        expect(draw?.seedingFingerprint).toBeTruthy()
        expect(await collectDrawConsistencyIssues(ready.draft.id)).toEqual([])
      },
      timeoutMs,
    )
  }

  it('supports close_control discipline in stress category', async () => {
    await ensureBracketDefaults()
    const seeded = await seedCategoryWithAthletes({
      participantCount: 4,
      discipline: 'close_control',
      weightCategoryId: 'stress_close_04',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: seeded.categoryKey, status: 'ACTIVE' },
      include: { participants: true },
    })
    expect(draw?.participants).toHaveLength(4)
    expect(draw?.autoSystemId).toBe('olympic')
  })

  it(
    'moves athlete between stress categories and transitions systems (2→1 champion, 1→2 olympic)',
    async () => {
      await ensureBracketDefaults()
      await seedBoutsPageSetting()
      const solo = await seedCategoryWithAthletes({ participantCount: 1, weightCategoryId: 'w_66' })
      const pair = await seedCategoryWithAthletes({ participantCount: 2, weightCategoryId: 'w_71' })
      registrationIds.push(...solo.registrationIds, ...pair.registrationIds)
      entryIds.push(...solo.entryIds, ...pair.entryIds)

      const draft = await createIsolatedDraft()
      generationIds.push(draft.id)
      const ready = await syncRedrawAll(draft.id, draft.version)
      generationIds.push(ready.draft.id)

      const movedOut = await moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId: pair.entryIds[0]!,
        targetCategoryKey: solo.categoryKey,
      })
      generationIds.push(movedOut.draft.id)

      const soloDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: movedOut.draft.id, categoryKey: solo.categoryKey },
      })
      const pairDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: movedOut.draft.id, categoryKey: pair.categoryKey },
      })
      expect(soloDraw?.autoSystemId).toBe('olympic')
      expect(pairDraw?.autoSystemId).toBe('champion')

      const movedBack = await moveBracketEntry({
        draftId: movedOut.draft.id,
        expectedVersion: movedOut.draft.version,
        entryId: pair.entryIds[0]!,
        targetCategoryKey: pair.categoryKey,
      })
      generationIds.push(movedBack.draft.id)

      const restoredPairDraw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: movedBack.draft.id, categoryKey: pair.categoryKey },
      })
      expect(restoredPairDraw?.autoSystemId).toBe('olympic')
    },
    60_000,
  )

  it('applies round_robin override on five-athlete category via draw update', async () => {
    const { matrix, draft } = await prepareMatrixDraft([5])
    const category = matrix.categories[0]!

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: draft.id, categoryKey: category.categoryKey, status: 'ACTIVE' },
    })

    const updated = await updateBracketDraw({
      drawId: draw.id,
      draftId: draft.id,
      expectedVersion: draft.version,
      systemOverride: 'round_robin',
    })
    generationIds.push(updated.draft.id)

    const after = await prisma.bracketCategoryDraw.findUniqueOrThrow({ where: { id: draw.id } })
    expect(after.systemOverride).toBe('round_robin')
    expect(after.publishedStructureJson).toBeTruthy()
    expect(await collectDrawConsistencyIssues(updated.draft.id)).toEqual([])
  })

  it('manual seed swap on 8-athlete stress draw keeps valid seeds', async () => {
    const { matrix, draft } = await prepareMatrixDraft([8])
    const category = matrix.categories[0]!

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: draft.id, categoryKey: category.categoryKey, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = draw.participants
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()

    const swapped = await updateBracketDraw({
      drawId: draw.id,
      draftId: draft.id,
      expectedVersion: draft.version,
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        seedPosition:
          participant.entryId === first!.entryId
            ? second!.seedPosition
            : participant.entryId === second!.entryId
              ? first!.seedPosition
              : participant.seedPosition,
      })),
    })
    generationIds.push(swapped.draft.id)

    expect(await collectDrawConsistencyIssues(swapped.draft.id)).toEqual([])
  })

  it('assigns mat index and releases bouts for 12-athlete olympic stress category', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const { matrix, draft } = await prepareMatrixDraft([12])
    const category = matrix.categories[0]!

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: draft.id, categoryKey: category.categoryKey, status: 'ACTIVE' },
    })

    const withMat = await updateBracketDrawMatIndex({
      drawId: draw.id,
      draftId: draft.id,
      expectedVersion: draft.version,
      matIndex: 2,
    })
    generationIds.push(withMat.draft.id)

    const published = await publishActiveForIntegration({
      draftId: withMat.draft.id,
      expectedVersion: withMat.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    const publishedDraw = await prisma.bracketCategoryDraw.findUniqueOrThrow({
      where: { id: draw.id },
      include: { participants: true },
    })
    expect(publishedDraw.matIndex).toBe(2)

    const release = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: category.categoryKey,
      released: true,
      expectedPublishedDrawId: draw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })
    expect(release.affectedCategoryKeys).toContain(category.categoryKey)

    const publicationState = await prisma.bracketPublicationState.findUniqueOrThrow({
      where: { categoryKey: category.categoryKey },
    })
    const bouts = extractPlayableBoutsForPair({
      draw: publishedDraw,
      publicationState,
    })
    expect(bouts.length).toBeGreaterThan(0)
  })

  it(
    'removes unpaid athlete from draw but keeps manual placement after move',
    async () => {
      await ensureBracketDefaults()
      await seedBoutsPageSetting()
      const source = await seedCategoryWithAthletes({ participantCount: 4, weightCategoryId: 'w_77' })
      const target = await seedCategoryWithAthletes({ participantCount: 6, weightCategoryId: 'w_84' })
      registrationIds.push(...source.registrationIds, ...target.registrationIds)
      entryIds.push(...source.entryIds, ...target.entryIds)

      const draft = await createIsolatedDraft()
      generationIds.push(draft.id)
      const ready = await syncRedrawAll(draft.id, draft.version)
      generationIds.push(ready.draft.id)
      const entryId = source.entryIds[0]!

      const moved = await moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId,
        targetCategoryKey: target.categoryKey,
      })
      generationIds.push(moved.draft.id)

      await prisma.athleteEntry.update({
        where: { id: entryId },
        data: { paymentStatus: 'UNPAID' },
      })

      await prisma.$transaction(async (tx) => {
        await forceRebuildCategories(tx, {
          generationId: moved.draft.id,
          categoryKeys: [target.categoryKey],
          preserveVisible: true,
        })
      }, BRACKET_MUTATION_TX_OPTIONS)

      const participant = await prisma.bracketDrawParticipant.findFirst({
        where: { entryId, draw: { generationId: moved.draft.id } },
      })
      const placement = await prisma.bracketEntryPlacement.findUnique({ where: { entryId } })

      expect(participant).toBeNull()
      expect(placement?.categoryKey).toBe(target.categoryKey)
    },
    120_000,
  )

  it(
    'redraws only stale target category after cross-category move',
    async () => {
      await ensureBracketDefaults()
      await seedBoutsPageSetting()
      const small = await seedCategoryWithAthletes({ participantCount: 8, weightCategoryId: 'w_77' })
      const large = await seedCategoryWithAthletes({ participantCount: 12, weightCategoryId: 'w_84' })
      registrationIds.push(...small.registrationIds, ...large.registrationIds)
      entryIds.push(...small.entryIds, ...large.entryIds)

      const draft = await createIsolatedDraft()
      generationIds.push(draft.id)
      const ready = await syncRedrawAll(draft.id, draft.version)
      generationIds.push(ready.draft.id)

      const beforeSmall = await prisma.bracketCategoryDraw.findFirstOrThrow({
        where: { generationId: ready.draft.id, categoryKey: small.categoryKey },
      })
      const beforeLarge = await prisma.bracketCategoryDraw.findFirstOrThrow({
        where: { generationId: ready.draft.id, categoryKey: large.categoryKey },
      })

      const moved = await moveBracketEntry({
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        entryId: small.entryIds[0]!,
        targetCategoryKey: large.categoryKey,
      })
      generationIds.push(moved.draft.id)

      const redrawn = await redrawBracketDraft({
        draftId: moved.draft.id,
        expectedVersion: moved.draft.version,
        scope: 'category',
        categoryKey: large.categoryKey,
      })
      generationIds.push(redrawn.draft.id)

      const afterSmall = await prisma.bracketCategoryDraw.findUniqueOrThrow({
        where: { id: beforeSmall.id },
      })
      const afterLarge = await prisma.bracketCategoryDraw.findUniqueOrThrow({
        where: { id: beforeLarge.id },
      })

      expect(afterLarge.redrawRevision).toBeGreaterThan(beforeLarge.redrawRevision)
      expect(afterSmall.redrawRevision).toBeGreaterThan(beforeSmall.redrawRevision)
      expect(await collectDrawConsistencyIssues(redrawn.draft.id)).toEqual([])
    },
    120_000,
  )
})
