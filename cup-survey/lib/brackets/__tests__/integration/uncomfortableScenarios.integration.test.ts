import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { extractPlayableBoutsForPair } from '../../../bouts/extractForPair'
import { isBoutsRepairRequired } from '../../../bouts/repairRequired'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { getParticipantClubConflictHint, computeCategoryDrawBalance } from '../../admin/computeDrawBalance'
import { applyDraftMutationToDashboard } from '../../admin/cacheUpdate'
import { overlayAllCategoryKeysWithLiveCategories } from '../../admin/moveTargetOptions'
import { readPublishedStructure } from '../../core/readPublishedStructure'
import { getEffectiveBronzeMode } from '../../core/formatRules'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import { syncBracketDraft } from '../../generation/sync'
import { moveBracketEntry } from '../../placements'
import {
  getAdminBracketsDashboard,
  getPublicBrackets,
  updateBracketDraw,
} from '../../service'
import {
  CAT_A,
  CAT_B,
  CAT_C,
  cleanupBracketIntegrationData,
  collectDrawConsistencyIssues,
  createIsolatedDraft,
  ensureBracketDefaults,
  publishActiveForIntegration,
  resetRegistrationRevision,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  seedPaidEntry,
  seedPaidPairInCategory,
  seedTwoPaidEntriesDifferentClubs,
  seedTwoPaidEntriesSameRegistration,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

function firstRoundEntryIds(structure: ReturnType<typeof readPublishedStructure>): string[] {
  if (!structure?.rounds?.length) return []
  const ids: string[] = []
  for (const match of structure.rounds) {
    if (match.round !== 1) continue
    if (match.participantA?.entryId) ids.push(match.participantA.entryId)
    if (match.participantB?.entryId) ids.push(match.participantB.entryId)
  }
  return ids
}

describe('uncomfortable scenario audit (local integration)', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await seedBoutsPageSetting()
    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true, includePaid: true, includeUnpaid: false },
    })
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: false },
    })
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  async function preparePairDraft() {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)
    return { ready, entryIds: seeded.entryIds }
  }

  it('Q1: move with mixed PAID/DEBT entries keeps placements and draw participants consistent', async () => {
    await ensureBracketDefaults()
    const seeded = await seedTwoPaidEntriesSameRegistration()
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    await prisma.athleteEntry.update({
      where: { id: seeded.entryIds[1] },
      data: { paymentStatus: 'DEBT', paymentStage: 'early', paidAt: null },
    })

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const moved = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId: seeded.entryIds[0],
      targetCategoryKey: CAT_B,
    })
    generationIds.push(moved.draft.id)

    const placementA = await prisma.bracketEntryPlacement.findUnique({
      where: { entryId: seeded.entryIds[0] },
    })
    expect(placementA?.categoryKey).toBe(CAT_B)

    const targetDraw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: moved.draft.id, categoryKey: CAT_B, status: 'ACTIVE' },
      include: { participants: true },
    })
    expect(targetDraw.participants.map((participant) => participant.entryId).sort()).toEqual(
      [...seeded.entryIds].sort(),
    )

    const issues = await collectDrawConsistencyIssues(moved.draft.id)
    expect(issues).toEqual([])
  })

  it('Q2: manual seed swap on visible released category updates public structure and bouts', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    const seeded = await seedCategoryWithAthletes({ participantCount: 8 })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: ready.draft.id, categoryKey: seeded.categoryKey, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: seeded.categoryKey,
      visible: true,
    })
    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: seeded.categoryKey,
      released: true,
      expectedPublishedDrawId: draw.id,
      expectedPublishedGenerationId: ready.draft.id,
    })

    const [first, second] = draw.participants
    await updateBracketDraw({
      drawId: draw.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      participants: draw.participants.map((participant) => ({
        entryId: participant.entryId,
        seedPosition:
          participant.entryId === first.entryId
            ? second.seedPosition
            : participant.entryId === second.entryId
              ? first.seedPosition
              : participant.seedPosition,
      })),
    })

    const publicData = await getPublicBrackets()
    const category = publicData!.categories.find((item) => item.categoryKey === seeded.categoryKey)
    expect(category).toBeTruthy()
    expect(category!.participants[0]?.entryId).toBe(second.entryId)

    const pair = await prisma.bracketPublicationState.findUniqueOrThrow({
      where: { categoryKey: seeded.categoryKey },
      include: { publishedDraw: { include: { participants: { orderBy: { seedPosition: 'asc' } } } } },
    })
    const publicStructure = readPublishedStructure({
      publishedStructureJson: pair.publishedDraw.publishedStructureJson,
      autoSystemId: pair.publishedDraw.autoSystemId,
      systemOverride: pair.publishedDraw.systemOverride,
      systemVersion: pair.publishedDraw.systemVersion,
      autoBronzeMode: pair.publishedDraw.autoBronzeMode,
      bronzeModeOverride: pair.publishedDraw.bronzeModeOverride,
      drawSeed: pair.publishedDraw.drawSeed,
      participants: pair.publishedDraw.participants,
      effectiveBronzeMode: getEffectiveBronzeMode(
        pair.publishedDraw.autoBronzeMode,
        pair.publishedDraw.bronzeModeOverride,
      ),
    })
    expect(firstRoundEntryIds(category!.structure)).toContain(second.entryId)

    const bouts = extractPlayableBoutsForPair({
      publicationState: pair,
      draw: pair.publishedDraw,
    })
    expect(bouts.length).toBeGreaterThan(0)
  })

  it('Q3: same-club manual swap surfaces club conflict hint without blocking', async () => {
    const seeded = await seedPaidPairInCategory('w_66', 'club')
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: ready.draft.id, categoryKey: CAT_A, status: 'ACTIVE' },
      include: { participants: { orderBy: { seedPosition: 'asc' } } },
    })
    const [first, second] = draw.participants

    const swapped = await updateBracketDraw({
      drawId: draw.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      participants: [
        { entryId: first.entryId, seedPosition: second.seedPosition },
        { entryId: second.entryId, seedPosition: first.seedPosition },
      ],
    })
    expect(swapped.category?.participants).toBeTruthy()

    const participants = swapped.category!.participants.map((participant) => ({
      entryId: participant.entryId,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
      clubKey: participant.clubKey,
    }))
    const report = computeCategoryDrawBalance(participants)
    const hint = getParticipantClubConflictHint(
      { clubKey: participants[0]?.clubKey ?? null },
      report,
      participants.length,
    )
    expect(hint).toBeTruthy()
  })

  it('Q4: reverting payment removes athlete from draw after sync', async () => {
    const { ready, entryIds: ids } = await preparePairDraft()
    const targetEntryId = ids[0]

    await prisma.athleteEntry.update({
      where: { id: targetEntryId },
      data: { paymentStatus: 'UNPAID', paidAt: null, paymentStage: null },
    })

    const synced = await syncBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      scope: 'all',
      afterRegistrationChange: true,
    })
    generationIds.push(synced.draft.id)

    const stillParticipant = await prisma.bracketDrawParticipant.findFirst({
      where: { entryId: targetEntryId, draw: { generationId: synced.draft.id } },
    })
    expect(stillParticipant).toBeNull()

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })
    const publicData = await getPublicBrackets()
    const visibleEntryIds = new Set(
      publicData!.categories.flatMap((category) =>
        category.participants.map((participant) => participant.entryId),
      ),
    )
    expect(visibleEntryIds.has(targetEntryId)).toBe(false)
  })

  it('Q5: 1→2 via move transitions champion draw to olympic', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('solo-champion')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const incoming = await seedPaidEntryInCategory(CAT_B)
    registrationIds.push(incoming.registrationId)
    entryIds.push(incoming.entryId)

    const resynced = await syncRedrawAll(ready.draft.id, ready.draft.version)
    generationIds.push(resynced.draft.id)

    const sourceDraw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: resynced.draft.id, categoryKey: CAT_A },
    })
    expect(sourceDraw.autoSystemId).toBe('champion')

    const moved = await moveBracketEntry({
      draftId: resynced.draft.id,
      expectedVersion: resynced.draft.version,
      entryId: incoming.entryId,
      targetCategoryKey: CAT_A,
    })
    generationIds.push(moved.draft.id)

    const updated = await prisma.bracketCategoryDraw.findUniqueOrThrow({
      where: { id: sourceDraw.id },
      include: { participants: true },
    })
    expect(updated.autoSystemId).toBe('olympic')
    expect(updated.participants.length).toBe(2)
    expect(updated.publishedStructureJson).toBeTruthy()
  })

  it('Q6: consecutive moves into same target keep dashboard category counts accurate', async () => {
    const a = await seedPaidPairInCategory('w_66', 'move-a')
    const b = await seedPaidPairInCategory('w_71', 'move-b')
    registrationIds.push(a.registrationId, b.registrationId)
    entryIds.push(...a.entryIds, ...b.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const targetKey = CAT_C
    const firstMove = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId: a.entryIds[0],
      targetCategoryKey: targetKey,
    })

    let dashboard = applyDraftMutationToDashboard(
      (await getAdminBracketsDashboard()) as never,
      { draft: firstMove.draft, categories: firstMove.categories ?? [] },
    )
    expect(
      overlayAllCategoryKeysWithLiveCategories(
        dashboard!.allCategoryKeys,
        dashboard!.categories,
      ).find((item) => item.key === targetKey)?.participantCount,
    ).toBe(1)

    const secondMove = await moveBracketEntry({
      draftId: firstMove.draft.id,
      expectedVersion: firstMove.draft.version,
      entryId: b.entryIds[0],
      targetCategoryKey: targetKey,
    })

    dashboard = applyDraftMutationToDashboard(dashboard!, {
      draft: secondMove.draft,
      categories: secondMove.categories ?? [],
    })
    expect(
      overlayAllCategoryKeysWithLiveCategories(
        dashboard!.allCategoryKeys,
        dashboard!.categories,
      ).find((item) => item.key === targetKey)?.participantCount,
    ).toBe(2)
  })

  it('Q8: emptying a visible source category hides it from public brackets', async () => {
    const source = await seedPaidPairInCategory('w_66', 'visible-source')
    const sink = await seedPaidPairInCategory('w_71', 'visible-sink')
    registrationIds.push(source.registrationId, sink.registrationId)
    entryIds.push(...source.entryIds, ...sink.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.draft.id)

    await setCategoriesPublicVisibility({ scope: 'category', categoryKey: CAT_A, visible: true })

    const move1 = await moveBracketEntry({
      draftId: published.draft.id,
      expectedVersion: published.draft.version,
      entryId: source.entryIds[0],
      targetCategoryKey: CAT_B,
    })
    const move2 = await moveBracketEntry({
      draftId: move1.draft.id,
      expectedVersion: move1.draft.version,
      entryId: source.entryIds[1],
      targetCategoryKey: CAT_B,
    })
    generationIds.push(move2.draft.id)

    const state = await prisma.bracketPublicationState.findUnique({ where: { categoryKey: CAT_A } })
    expect(state?.visible ?? false).toBe(false)

    const publicData = await getPublicBrackets()
    expect(publicData!.categories.some((category) => category.categoryKey === CAT_A)).toBe(false)
  })

  it('Q10: reducing mat count flags repair when visible fixed mat is out of range', async () => {
    const prepared = await seedCategoryWithAthletes({ participantCount: 4 })
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirstOrThrow({
      where: { generationId: published.publishedGenerationId, categoryKey: prepared.categoryKey },
    })

    await prisma.boutsPageSetting.update({ where: { id: 'default' }, data: { matCount: 2 } })
    await prisma.bracketCategoryDraw.update({
      where: { id: draw.id },
      data: { matIndex: 2 },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: prepared.categoryKey,
      visible: true,
    })

    const state = await prisma.bracketPublicationState.findUniqueOrThrow({
      where: { categoryKey: prepared.categoryKey },
    })
    expect(state.boutsReleased).toBe(false)
    expect(
      isBoutsRepairRequired({
        visible: state.visible,
        boutsReleased: state.boutsReleased,
        storedMatIndex: 2,
        matCount: 1,
      }),
    ).toBe(true)
  })
})

async function ensureChampionFormatRule() {
  const existing = await prisma.bracketFormatRule.findFirst({
    where: { minParticipants: 1, maxParticipants: 1, enabled: true },
  })
  if (existing) return
  await prisma.bracketFormatRule.create({
    data: {
      minParticipants: 1,
      maxParticipants: 1,
      systemId: 'champion',
      allowedSystemIds: ['champion'],
      sortOrder: -1,
      enabled: true,
    },
  })
}

async function seedPaidEntryInCategory(categoryKey: string) {
  const weightCategoryId = categoryKey.split(':').pop() ?? 'w_66'
  const registration = await prisma.teamRegistration.create({
    data: {
      clubName: 'Incoming Club',
      city: 'City B',
      phone: `+7999${String(Date.now()).slice(-7)}`,
      registrationStage: 'main',
      pricePerDiscipline: 1000,
      totalAmount: 1000,
      consentPersonalData: true,
      consentPublication: true,
      status: 'PAID',
      athletes: {
        create: {
          lastName: 'Новик',
          firstName: 'Б',
          birthDate: new Date('2012-02-02'),
          gender: 'male',
          entries: {
            create: {
              discipline: 'tactic_control',
              experienceLevel: 'beginner',
              ageDivisionId: 'm_juniors_1',
              weightCategoryId,
              price: 1000,
              paymentStatus: 'PAID',
              paidAt: new Date(),
            },
          },
        },
      },
    },
    include: { athletes: { include: { entries: true } } },
  })
  return {
    registrationId: registration.id,
    entryId: registration.athletes[0]!.entries[0]!.id,
  }
}
