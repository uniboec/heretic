import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { extractPlayableBoutsForPair } from '../../../bouts/extractForPair'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { moveBracketEntry } from '../../placements'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import { getPublicBrackets, getPublicResults } from '../../service'
import { rebuildDrawAfterCompositionChange } from '../../generation/rebuildDraw'
import { readCategoryResult } from '../../core/readCategoryResult'
import { deserializePublishedStructure } from '../../core/snapshot'
import { forceRebuildCategories } from '../../live/forceRebuild'
import { previewConsolidation, applyConsolidation } from '../../consolidation/apply'
import { legacyPolicy, legacyStep } from '../../consolidation/__tests__/fixtures'
import {
  CAT_A,
  CAT_B,
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  publishActiveForIntegration,
  resetRegistrationRevision,
  seedPaidEntry,
  seedPaidPairInCategory,
  seedBoutsPageSetting,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

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

describe('champion category integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    await seedBoutsPageSetting()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('sync builds ACTIVE champion for singleton category', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('solo')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id },
      include: { participants: true },
    })

    expect(draw?.status).toBe('ACTIVE')
    expect(draw?.autoSystemId).toBe('champion')
    expect(draw?.participants).toHaveLength(1)

    const snapshot = deserializePublishedStructure(draw?.publishedStructureJson)
    expect(snapshot?.systemId).toBe('champion')
    expect(readCategoryResult(snapshot?.structure ?? null, 'champion')).toMatchObject({
      status: 'complete',
      placements: [{ placement: 1, reason: 'SINGLE_PARTICIPANT' }],
    })
  })

  it('2→1 via move transitions olympic to champion', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const pair = await seedPaidPairInCategory('w_66', 'pair')
    registrationIds.push(pair.registrationId)
    entryIds.push(...pair.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const sourceDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    expect(sourceDraw?.autoSystemId).toBe('olympic')

    const moved = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId: pair.entryIds[1],
      targetCategoryKey: CAT_B,
    })
    generationIds.push(moved.draft.id)

    const remainingDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: moved.draft.id, categoryKey: sourceDraw!.categoryKey },
    })
    expect(remainingDraw?.autoSystemId).toBe('champion')
    expect(remainingDraw?.status).toBe('ACTIVE')
  })

  it('1→2 via move transitions champion to olympic', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const pair = await seedPaidPairInCategory('w_66', 'one-two')
    registrationIds.push(pair.registrationId)
    entryIds.push(...pair.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const sourceDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    expect(sourceDraw?.autoSystemId).toBe('olympic')

    const afterMoveOut = await moveBracketEntry({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      entryId: pair.entryIds[1],
      targetCategoryKey: CAT_B,
    })
    generationIds.push(afterMoveOut.draft.id)

    const championDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: afterMoveOut.draft.id, categoryKey: sourceDraw!.categoryKey },
    })
    expect(championDraw?.autoSystemId).toBe('champion')

    const afterMoveIn = await moveBracketEntry({
      draftId: afterMoveOut.draft.id,
      expectedVersion: afterMoveOut.draft.version,
      entryId: pair.entryIds[1],
      targetCategoryKey: sourceDraw!.categoryKey,
    })
    generationIds.push(afterMoveIn.draft.id)

    const updated = await prisma.bracketCategoryDraw.findUnique({
      where: { id: championDraw!.id },
    })
    expect(updated?.autoSystemId).toBe('olympic')
    expect(updated?.status).toBe('ACTIVE')
  })

  it('backfill converts INACTIVE singleton without changing visible', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('backfill')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const draw = await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Backfill cat',
        status: 'INACTIVE',
        drawSeed: 'seed',
        redrawRevision: 0,
        participants: {
          create: {
            entryId: solo.entryId,
            seedPosition: 1,
            seedLocked: false,
          },
        },
      },
    })

    await prisma.bracketPublicationState.create({
      data: {
        categoryKey: CAT_A,
        publishedDrawId: draw.id,
        visible: false,
        boutsReleased: false,
      },
    })

    await prisma.$transaction(async (tx) => {
      const rules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
      await rebuildDrawAfterCompositionChange(tx, draw.id, rules, 1)
    })

    const updated = await prisma.bracketCategoryDraw.findUnique({ where: { id: draw.id } })
    const state = await prisma.bracketPublicationState.findUnique({ where: { categoryKey: CAT_A } })

    expect(updated?.status).toBe('ACTIVE')
    expect(updated?.autoSystemId).toBe('champion')
    expect(state?.visible).toBe(false)
  })

  it('visible champion appears on public brackets and releases to awards schedule', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('public')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, autoSystemId: 'champion' },
      include: { participants: true },
    })
    expect(draw).not.toBeNull()

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: true,
    })

    const publicData = await getPublicBrackets()
    expect(publicData).not.toBeNull()
    expect(publicData!.categories.some((category) => category.categoryKey === draw!.categoryKey)).toBe(
      true,
    )

    const publicResults = await getPublicResults()
    expect(publicResults).not.toBeNull()
    const championRow = publicResults!.rows.find((row) => row.categoryKey === draw!.categoryKey)
    expect(championRow).toMatchObject({
      placement: 1,
      provisional: false,
      entryId: draw!.participants[0]?.entryId,
    })

    const categoryRelease = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      released: true,
      expectedPublishedDrawId: draw!.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })
    expect(categoryRelease.affectedCategoryKeys).toContain(draw!.categoryKey)

    const queue = await prisma.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: 'cup-2026',
          categoryKey: draw!.categoryKey,
        },
      },
    })
    expect(queue).not.toBeNull()

    const readyRelease = await setCategoriesBoutsReleased({
      scope: 'ready',
      released: true,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })
    expect(readyRelease.noop).toBe(true)
  })

  it('hidden champion after backfill is absent from public brackets', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('hidden-public')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const draw = await prisma.bracketCategoryDraw.create({
      data: {
        generationId: draft.id,
        categoryKey: CAT_A,
        discipline: 'tactic_control',
        title: 'Hidden champion cat',
        status: 'INACTIVE',
        drawSeed: 'seed',
        redrawRevision: 0,
        participants: {
          create: {
            entryId: solo.entryId,
            seedPosition: 1,
            seedLocked: false,
          },
        },
      },
    })

    await prisma.bracketPublicationState.create({
      data: {
        categoryKey: CAT_A,
        publishedDrawId: draw.id,
        visible: false,
        boutsReleased: false,
      },
    })

    await prisma.$transaction(async (tx) => {
      const rules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
      await rebuildDrawAfterCompositionChange(tx, draw.id, rules, 1)
    })

    const published = await publishActiveForIntegration({
      draftId: draft.id,
      expectedVersion: draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    const state = await prisma.bracketPublicationState.findUnique({ where: { categoryKey: CAT_A } })
    expect(state?.visible).toBe(false)

    const publicData = await getPublicBrackets()
    expect(publicData?.categories.some((category) => category.categoryKey === CAT_A)).toBe(false)
  })

  it('2→1 via forceRebuild transitions olympic to champion with canonical result', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const pair = await seedPaidPairInCategory('w_66', 'force-rebuild')
    registrationIds.push(pair.registrationId)
    entryIds.push(...pair.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const sourceDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    expect(sourceDraw?.autoSystemId).toBe('olympic')

    await prisma.bracketEntryPlacement.create({
      data: {
        entryId: pair.entryIds[1],
        categoryKey: CAT_B,
        isManualMove: true,
      },
    })

    await prisma.$transaction(async (tx) => {
      await forceRebuildCategories(tx, {
        generationId: ready.draft.id,
        categoryKeys: [sourceDraw!.categoryKey],
        preserveVisible: true,
      })
    })

    const rebuilt = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, categoryKey: sourceDraw!.categoryKey },
      include: { participants: true },
    })
    expect(rebuilt?.autoSystemId).toBe('champion')
    expect(rebuilt?.status).toBe('ACTIVE')
    expect(rebuilt?.participants).toHaveLength(1)

    const snapshot = deserializePublishedStructure(rebuilt?.publishedStructureJson)
    expect(readCategoryResult(snapshot?.structure ?? null, 'champion')).toMatchObject({
      status: 'complete',
      placements: [{ placement: 1, reason: 'SINGLE_PARTICIPANT' }],
    })

    const published = await publishActiveForIntegration({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.publishedGenerationId)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { id: rebuilt!.id },
      include: { participants: true, generation: true },
    })
    if (!publishedDraw) throw new Error('Expected published draw')

    const publicationState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: sourceDraw!.categoryKey },
    })
    if (!publicationState) throw new Error('Expected publication state')

    const bouts = extractPlayableBoutsForPair({
      draw: publishedDraw,
      publicationState,
    })
    expect(bouts).toEqual([])
  })

  it('applyConsolidation noop leaves singleton category as champion', async () => {
    await ensureBracketDefaults()
    await ensureChampionFormatRule()
    const solo = await seedPaidEntry('cons-noop')
    registrationIds.push(solo.registrationId)
    entryIds.push(solo.entryId)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    generationIds.push(ready.draft.id)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, autoSystemId: 'champion' },
    })
    expect(draw?.status).toBe('ACTIVE')

    const preview = await previewConsolidation({
      expectedVersion: ready.draft.version,
      policy: legacyPolicy({ steps: [legacyStep('WEIGHT_UP')] }),
    })
    expect(preview.plan.finalPlacements).toHaveLength(0)

    const applied = await applyConsolidation({
      expectedVersion: ready.draft.version,
      policy: preview.policy,
      consolidationPlanToken: preview.consolidationPlanToken,
    })
    generationIds.push(applied.draft.id)

    const after = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: applied.draft.id, id: draw!.id },
    })
    expect(after?.autoSystemId).toBe('champion')
    expect(after?.status).toBe('ACTIVE')
  })
})
