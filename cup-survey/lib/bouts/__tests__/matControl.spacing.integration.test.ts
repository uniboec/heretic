import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex } from '../mutations'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  NEW_TOURNAMENT_BOUTS_PAGE_SETTING,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  seedPaidPairInCategory,
  syncRedrawAll,
} from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
} from '../matControlService'
import { buildMatQueue } from '../matQueue'
import { postponeBoutOnMat } from '../postponeBout'
import type { ControlIntent } from '../mat-control/types'

async function purgeMatControlTables() {
  await prisma.scheduleMutationLog.deleteMany()
  await prisma.boutControlCommand.deleteMany()
  await prisma.boutEvent.deleteMany()
  await prisma.boutResultRevision.deleteMany()
  await prisma.boutResult.deleteMany()
  await prisma.resultCorrectionCase.deleteMany()
  await prisma.matControlSession.deleteMany()
  await prisma.athleteRestState.deleteMany()
  await prisma.boutScheduleExecution.deleteMany()
}

describe('mat control spacing integration', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  beforeEach(async () => {
    if (!dbAvailable) return
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    await purgeBracketIntegrationState()
    await purgeMatControlTables()
    await ensureBracketDefaults()
    await seedBoutsPageSetting(NEW_TOURNAMENT_BOUTS_PAGE_SETTING)
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

  async function seedReleasedBoutOnMat1() {
    const seeded = await seedPaidPairInCategory('w_66', 'spacing')
    registrationIds.push(seeded.registrationId)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    if (!draftDraw) throw new Error('Draft draw missing')

    const matUpdate = await updateBracketDrawMatIndex({
      drawId: draftDraw.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      matIndex: 1,
    })

    const published = await publishBracketDraft({
      draftId: matUpdate.draft.id,
      expectedVersion: matUpdate.draft.version,
    })
    generationIds.push(published.publishedGenerationId, published.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })
    if (!publishedDraw) throw new Error('Published draw missing')

    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: publishedDraw.categoryKey,
      released: true,
      expectedPublishedDrawId: publishedDraw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })

    const snapshot = await getMatControlSnapshot(1)
    const bout =
      snapshot.activeBout?.bout ??
      snapshot.queue.nextAvailable?.bout ??
      snapshot.queueInOrder[0]?.bout
    if (!bout) throw new Error('No bout on mat')

    await acquireMatSession(1, 'spacing-holder')

    return {
      boutId: bout.id,
      redEntryId: bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null,
      blueEntryId: bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null,
      holderToken: 'spacing-holder',
      snapshot,
    }
  }

  async function readScheduleVersion() {
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    return settings.scheduleVersion
  }

  async function runCommand(
    fixture: Awaited<ReturnType<typeof seedReleasedBoutOnMat1>>,
    state: { revision: number },
    operationId: string,
    intent: ControlIntent,
    payload: Record<string, unknown> = {},
  ) {
    if (!fixture.redEntryId || !fixture.blueEntryId) {
      throw new Error('Bout participants missing')
    }
    const response = (await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId,
        holderToken: fixture.holderToken,
        expectedLiveRevision: state.revision,
        expectedAttemptNumber: 1,
      },
      intent,
      payload,
      expectedScheduleVersion: await readScheduleVersion(),
    })) as { liveRevision?: number }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }
    return response
  }

  it('loads mat control snapshot with spacing enabled without REST blocks', async () => {
    const { snapshot } = await seedReleasedBoutOnMat1()
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    const spacing = settings.athleteParticipationSpacing as { enabled?: boolean } | null

    expect(spacing?.enabled).toBe(true)
    expect(snapshot.queue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(false)

    const activeBout = snapshot.activeBout?.bout ?? snapshot.queueInOrder[0]?.bout
    const restEntryId =
      activeBout?.sideA.kind === 'athlete'
        ? activeBout.sideA.entryId
        : activeBout?.sideB.kind === 'athlete'
          ? activeBout.sideB.entryId
          : null
    expect(restEntryId).toBeTruthy()

    const legacyQueue = buildMatQueue({
      bouts: snapshot.queueInOrder.map((entry) => entry.bout),
      completedBoutIds: new Set(),
      activeBoutId: null,
      restUntilByEntryId: new Map([[restEntryId!, new Date(Date.now() + 120_000)]]),
      now: new Date(),
      skipRestBlocks: false,
    })
    expect(legacyQueue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(true)
  })

  it('returns stable queue order across repeated snapshot loads', async () => {
    await seedReleasedBoutOnMat1()
    const first = await getMatControlSnapshot(1)
    const second = await getMatControlSnapshot(1)

    expect(second.pendingMatBoutIds).toEqual(first.pendingMatBoutIds)
    expect(second.queueInOrder.map((entry) => entry.bout.id)).toEqual(
      first.queueInOrder.map((entry) => entry.bout.id),
    )
  })

  it('runs full confirm flow with spacing enabled', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'sp-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId!,
      corner: 'red',
    })
    await runCommand(fixture, state, 'sp-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId!,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'sp-start', 'CLOCK_START')
    await runCommand(fixture, state, 'sp-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId!,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'sp-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'sp-confirm', 'CONFIRM')

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.activeBout?.execution.boutPhase).toBe('confirmed')
    expect(snapshot.queue.blocked.some((entry) => entry.blockedReason === 'REST')).toBe(false)
  })

  async function seedReleasedBracketOnMat1(participantCount = 8) {
    const seeded = await seedCategoryWithAthletes({
      participantCount,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE', categoryKey: seeded.categoryKey },
    })
    if (!draftDraw) throw new Error('Draft draw missing')

    const matUpdate = await updateBracketDrawMatIndex({
      drawId: draftDraw.id,
      draftId: ready.draft.id,
      expectedVersion: ready.draft.version,
      matIndex: 1,
    })

    const published = await publishBracketDraft({
      draftId: matUpdate.draft.id,
      expectedVersion: matUpdate.draft.version,
    })
    generationIds.push(published.publishedGenerationId, published.draft.id)

    const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: published.publishedGenerationId, status: 'ACTIVE' },
    })
    if (!publishedDraw) throw new Error('Published draw missing')

    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: publishedDraw.categoryKey,
      released: true,
      expectedPublishedDrawId: publishedDraw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })

    await acquireMatSession(1, 'spacing-holder')

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.pendingMatBoutIds.length).toBeGreaterThanOrEqual(2)

    return {
      holderToken: 'spacing-holder',
      categoryKey: publishedDraw.categoryKey,
      snapshot,
    }
  }

  it('postpones active bout when athlete spacing is enabled', async () => {
    const fixture = await seedReleasedBracketOnMat1(8)
    const postponedId = fixture.snapshot.session.activeBoutId
    if (!postponedId) throw new Error('Active bout missing')

    const result = await postponeBoutOnMat({
      boutId: postponedId,
      postponeBy: 1,
      holderToken: fixture.holderToken,
      expectedLiveRevision: 0,
      expectedAttemptNumber: 1,
      expectedScheduleVersion: await readScheduleVersion(),
    })

    expect(result.ok).toBe(true)
    expect(result.boutId).toBe(postponedId)
    expect(result.postponeAfterBoutId).toBeTruthy()

    const after = await getMatControlSnapshot(1)
    expect(after.pendingMatBoutIds.indexOf(postponedId)).toBeGreaterThan(
      after.pendingMatBoutIds.indexOf(result.postponeAfterBoutId!),
    )
    expect(after.session.activeBoutId).toBe(result.postponeAfterBoutId)

    const publicationState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixture.categoryKey },
    })
    const overrides = (publicationState?.scheduleOverrides ?? {}) as Record<
      string,
      { queueAfterBoutId?: string }
    >
    expect(overrides[postponedId]?.queueAfterBoutId).toBe(result.postponeAfterBoutId)
  })
})
