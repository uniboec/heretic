import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import { BoutsConfigurationError, ScheduleVersionConflictError } from '../../../bouts/errors'
import { setCategoriesBoutsReleased } from '../../../bouts/release'
import { parseBoutMatAssignments } from '../../../bouts/legacyReleaseGate'
import { isBoutsRepairRequired } from '../../../bouts/repairRequired'
import { publishBracketDraft } from '../../generation/publish'
import { syncBracketDraft } from '../../generation/sync'
import { setCategoriesPublicVisibility } from '../../generation/categoryVisibility'
import { updateBracketDrawMatIndex } from '../../../bouts/mutations'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
  seedBoutsPageSetting,
  seedThreePaidEntriesSameCategory,
  seedTwoPaidEntriesDifferentClubs,
  syncRedrawAll,
  createIsolatedDraft,
  ensureBracketDefaults,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('bouts release integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'false')
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

  async function publishPrepared() {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const result = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })
    generationIds.push(result.publishedGenerationId, result.draft.id)
    return { prepared, ...result }
  }

  it('Phase-1 dual-write: visible true→false clears boutsReleased and assignments', async () => {
    const { publishedGenerationId } = await publishPrepared()
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: publishedGenerationId, status: 'ACTIVE' },
    })
    expect(draw).not.toBeNull()

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: true,
    })

    let state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw!.categoryKey },
    })
    expect(state?.visible).toBe(true)
    expect(state?.boutsReleased).toBe(true)
    expect(parseBoutMatAssignments(state?.boutMatAssignments)).not.toBeNull()

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: false,
    })

    state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw!.categoryKey },
    })
    expect(state?.visible).toBe(false)
    expect(state?.boutsReleased).toBe(false)
    expect(state?.boutMatAssignments).toBeNull()
    expect(state?.matCountAtRelease).toBeNull()
  })

  it('Legacy Fixed out-of-range: visible true keeps boutsReleased false', async () => {
    const { publishedGenerationId } = await publishPrepared()
    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: publishedGenerationId, status: 'ACTIVE' },
    })

    await prisma.boutsPageSetting.update({ where: { id: 'default' }, data: { matCount: 2 } })
    await prisma.bracketCategoryDraw.update({
      where: { id: draw!.id },
      data: { matIndex: 3 },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw!.categoryKey,
      visible: true,
    })

    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw!.categoryKey },
    })
    expect(state?.visible).toBe(true)
    expect(state?.boutsReleased).toBe(false)
    expect(
      isBoutsRepairRequired({
        visible: true,
        boutsReleased: false,
        storedMatIndex: 3,
        matCount: 2,
      }),
    ).toBe(true)
  })

  it('Phase-1 dual-write: eligible Fixed releases with null assignments', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: prepared.draft.id, status: 'ACTIVE' },
    })
    expect(draftDraw).not.toBeNull()

    const matUpdate = await updateBracketDrawMatIndex({
      drawId: draftDraw!.id,
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      matIndex: 2,
    })

    const published = await publishBracketDraft({
      draftId: matUpdate.draft.id,
      expectedVersion: matUpdate.draft.version,
    })
    generationIds.push(published.publishedGenerationId, published.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })

    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: publishedDraw!.categoryKey,
      visible: true,
    })

    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: publishedDraw!.categoryKey },
    })
    expect(state?.boutsReleased).toBe(true)
    expect(state?.boutMatAssignments).toBeNull()
    expect(state?.matCountAtRelease).toBe(3)
  })
})

describe('bouts release integration Phase 2', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  beforeEach(async () => {
    if (!dbAvailable) return
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    await ensureBracketDefaults()
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

  async function publishTwoCategoryDraft() {
    await ensureBracketDefaults()
    const threeWay = await seedThreePaidEntriesSameCategory()
    const pair = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(threeWay.registrationId, ...pair.registrationIds)
    entryIds.push(...threeWay.entryIds, ...pair.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const draws = await prisma.bracketCategoryDraw.findMany({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    const autoDraw = draws.find((draw) => draw.categoryKey.includes('w_71'))
    const fixedDraw = draws.find((draw) => draw.categoryKey.includes('w_66'))
    expect(autoDraw).toBeDefined()
    expect(fixedDraw).toBeDefined()

    if (fixedDraw) {
      const matUpdate = await updateBracketDrawMatIndex({
        drawId: fixedDraw.id,
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        matIndex: 2,
      })
      ready.draft = matUpdate.draft
    }

    const published = await publishBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
    })
    generationIds.push(published.publishedGenerationId, published.draft.id)

    const publishedDraws = await prisma.bracketCategoryDraw.findMany({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })
    const publishedAuto = publishedDraws.find((draw) => draw.categoryKey === autoDraw!.categoryKey)
    const publishedFixed = publishedDraws.find((draw) => draw.categoryKey === fixedDraw!.categoryKey)

    return {
      publishedGenerationId: published.publishedGenerationId,
      autoKey: publishedAuto!.categoryKey,
      fixedKey: publishedFixed!.categoryKey,
      autoDrawId: publishedAuto!.id,
      fixedDrawId: publishedFixed!.id,
    }
  }

  it('bumps scheduleVersion on category release with expectedScheduleVersion', async () => {
    if (!dbAvailable) return

    const { publishedGenerationId, autoKey, autoDrawId } = await publishTwoCategoryDraft()
    const before = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })

    const result = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: autoKey,
      released: true,
      expectedPublishedDrawId: autoDrawId,
      expectedPublishedGenerationId: publishedGenerationId,
      expectedScheduleVersion: before.scheduleVersion,
    })

    expect(result.scheduleVersion).toBe(before.scheduleVersion + 1)
  })

  it('rejects release when expectedScheduleVersion is stale', async () => {
    if (!dbAvailable) return

    const { publishedGenerationId, autoKey, autoDrawId } = await publishTwoCategoryDraft()
    const before = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })

    await expect(
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: autoKey,
        released: true,
        expectedPublishedDrawId: autoDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
        expectedScheduleVersion: before.scheduleVersion - 1,
      }),
    ).rejects.toBeInstanceOf(ScheduleVersionConflictError)
  })

  it('single category release is idempotent and preserves assignments', async () => {
    const { publishedGenerationId, autoKey, autoDrawId } = await publishTwoCategoryDraft()

    const first = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: autoKey,
      released: true,
      expectedPublishedDrawId: autoDrawId,
      expectedPublishedGenerationId: publishedGenerationId,
    })
    expect(first.noop).not.toBe(true)

    const afterFirst = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: autoKey },
    })
    const assignments = parseBoutMatAssignments(afterFirst?.boutMatAssignments)

    const second = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: autoKey,
      released: true,
      expectedPublishedDrawId: autoDrawId,
      expectedPublishedGenerationId: publishedGenerationId,
    })
    expect(second).toMatchObject({ ok: true, noop: true })

    const afterSecond = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: autoKey },
    })
    expect(parseBoutMatAssignments(afterSecond?.boutMatAssignments)).toEqual(assignments)
  })

  it('two-pass bulk release assigns Fixed before Auto load balancing', async () => {
    const { publishedGenerationId, autoKey, fixedKey } = await publishTwoCategoryDraft()

    await setCategoriesBoutsReleased({
      scope: 'ready',
      released: true,
      expectedPublishedGenerationId: publishedGenerationId,
    })

    const fixedState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixedKey },
    })
    const autoState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: autoKey },
    })

    expect(fixedState?.boutsReleased).toBe(true)
    expect(fixedState?.boutMatAssignments).toBeNull()
    expect(autoState?.boutsReleased).toBe(true)
    const autoAssignments = parseBoutMatAssignments(autoState?.boutMatAssignments)
    expect(autoAssignments).not.toBeNull()
    expect(Object.keys(autoAssignments ?? {}).length).toBeGreaterThan(0)
    expect(Object.values(autoAssignments ?? {}).every((mat) => mat >= 1 && mat <= 3)).toBe(true)
  })

  it('throws BoutsConfigurationError on corrupt released Auto assignments', async () => {
    const { publishedGenerationId, autoKey, autoDrawId, fixedKey, fixedDrawId } =
      await publishTwoCategoryDraft()

    await prisma.bracketPublicationState.update({
      where: { categoryKey: autoKey },
      data: {
        boutsReleased: true,
        boutMatAssignments: { 'bad::bout-1': 99 },
        matCountAtRelease: 3,
      },
    })

    await expect(
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: fixedKey,
        released: true,
        expectedPublishedDrawId: fixedDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
    ).rejects.toBeInstanceOf(BoutsConfigurationError)
  })

  it('parallel category releases serialize via tournament lock', async () => {
    const { publishedGenerationId, autoKey, fixedKey, autoDrawId, fixedDrawId } =
      await publishTwoCategoryDraft()

    const [autoResult, fixedResult] = await Promise.all([
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: autoKey,
        released: true,
        expectedPublishedDrawId: autoDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: fixedKey,
        released: true,
        expectedPublishedDrawId: fixedDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
    ])

    expect(autoResult.ok).toBe(true)
    expect(fixedResult.ok).toBe(true)

    const states = await prisma.bracketPublicationState.findMany({
      where: { categoryKey: { in: [autoKey, fixedKey] } },
    })
    expect(states.every((state) => state.boutsReleased)).toBe(true)
  })

  it('Fixed guard: re-release returns noop without changing state', async () => {
    const { publishedGenerationId, fixedKey, fixedDrawId } = await publishTwoCategoryDraft()

    const first = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: fixedKey,
      released: true,
      expectedPublishedDrawId: fixedDrawId,
      expectedPublishedGenerationId: publishedGenerationId,
    })
    expect(first.noop).not.toBe(true)

    const afterFirst = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixedKey },
    })

    const second = await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: fixedKey,
      released: true,
      expectedPublishedDrawId: fixedDrawId,
      expectedPublishedGenerationId: publishedGenerationId,
    })
    expect(second).toMatchObject({ ok: true, noop: true })

    const afterSecond = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixedKey },
    })
    expect(afterSecond?.boutMatAssignments).toEqual(afterFirst?.boutMatAssignments)
    expect(afterSecond?.matCountAtRelease).toBe(afterFirst?.matCountAtRelease)
  })

  it('blocks release when category readiness is stale after registration change', async () => {
    const { publishedGenerationId, autoKey, autoDrawId } = await publishTwoCategoryDraft()

    await seedTwoPaidEntriesDifferentClubs()

    await expect(
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: autoKey,
        released: true,
        expectedPublishedDrawId: autoDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CATEGORY' })
  })

  it('readiness race: parallel sync and release never leave stale boutsReleased', async () => {
    const { publishedGenerationId, autoKey, autoDrawId } = await publishTwoCategoryDraft()

    await seedTwoPaidEntriesDifferentClubs()

    const draft = await prisma.bracketGeneration.findFirst({
      where: { singletonKey: 'live' },
    })
    expect(draft).not.toBeNull()

    const [releaseResult, syncResult] = await Promise.allSettled([
      setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: autoKey,
        released: true,
        expectedPublishedDrawId: autoDrawId,
        expectedPublishedGenerationId: publishedGenerationId,
      }),
      syncBracketDraft({
        draftId: draft!.id,
        expectedVersion: draft!.version,
        scope: 'all',
      }),
    ])

    const state = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: autoKey },
    })

    if (releaseResult.status === 'rejected') {
      expect(releaseResult.reason).toMatchObject({ code: 'UNSUPPORTED_CATEGORY' })
      expect(state?.boutsReleased).toBe(false)
    } else {
      expect(releaseResult.value.ok).toBe(true)
      expect(state?.boutsReleased).toBe(true)
    }

    expect(releaseResult.status === 'fulfilled' || syncResult.status === 'fulfilled').toBe(true)
  })
})
