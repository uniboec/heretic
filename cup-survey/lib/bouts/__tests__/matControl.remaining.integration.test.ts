import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { updateBracketDraw } from '../../brackets/service'
import { deserializePublishedStructure } from '../../brackets/core/snapshot'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex } from '../mutations'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  seedPaidPairInCategory,
  syncRedrawAll,
} from '../../brackets/__tests__/integration/helpers'
import { getRegistrationCategoryKey } from '../../registration/categoryIdentity'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import {
  applyBoutResultCorrection,
  previewBoutResultCorrection,
} from '../applyBoutResultCorrection'
import { createDefaultExecutionData } from '../matControlMappers'
import {
  CommandNotAllowedError,
  CorrectionBlockedError,
  LeaseNotHeldError,
  LeaseStaleError,
  StaleLiveRevisionError,
} from '../mat-control/errors'
import type { ControlIntent } from '../mat-control/types'
import { extractBouts } from '../extractBouts'
import { buildBoutConfirmationSummary } from '../formatBoutConfirmation'
import { getPublicBouts } from '../service'
import { postponeBoutOnMat } from '../postponeBout'
import { buildScheduledMatsResultOrThrow, readFullScheduleSnapshot } from '../scheduleService'
import { resolveDownstreamBoutIds } from '../sportDependencies'
import { resolveBoutDurationMinutes } from '../boutDuration'
import {
  acquireMatSession,
  executeMatControlCommand,
  focusMatBout,
  getMatControlSnapshot,
  takeoverMatSession,
} from '../matControlService'
import type { InternalBout } from '../types'
import { insertSharedEpisodeTie } from './helpers/runSharedEpisodeTie'

async function purgeMatControlTables() {
  await prisma.boutControlCommand.deleteMany()
  await prisma.boutEvent.deleteMany()
  await prisma.boutResultRevision.deleteMany()
  await prisma.boutResult.deleteMany()
  await prisma.resultCorrectionCase.deleteMany()
  await prisma.matControlSession.deleteMany()
  await prisma.athleteRestState.deleteMany()
  await prisma.boutScheduleExecution.deleteMany()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForCommandReservation(boutId: string, operationId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const command = await prisma.boutControlCommand.findUnique({
      where: {
        boutId_operationId: {
          boutId,
          operationId,
        },
      },
    })
    if (command) return
    await sleep(25)
  }
  throw new Error(`command reservation timeout for ${operationId}`)
}

function pickRunnableBout(snapshot: Awaited<ReturnType<typeof getMatControlSnapshot>>): InternalBout {
  const candidates = [
    snapshot.activeBout?.bout,
    snapshot.queue.nextAvailable?.bout,
    ...snapshot.queue.upcoming.map((entry) => entry.bout),
  ].filter((bout): bout is InternalBout => Boolean(bout))

  const bout = candidates.find(
    (candidate) => candidate.sideA.kind === 'athlete' && candidate.sideB.kind === 'athlete',
  )
  if (!bout) throw new Error('Bout participants missing')
  return bout
}

describe('mat control remaining plan integration', () => {
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

  async function seedReleasedCategory(input?: {
    participantCount?: number
    roundRobin?: boolean
  }) {
    const participantCount = input?.participantCount ?? 4
    const seeded = await seedCategoryWithAthletes({
      participantCount,
      weightCategoryId: 'w_66',
    })
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    let ready = await syncRedrawAll(draft.id, draft.version)

    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE', categoryKey: seeded.categoryKey },
    })
    if (!draftDraw) throw new Error('Draft draw missing')

    if (input?.roundRobin) {
      const updated = await updateBracketDraw({
        drawId: draftDraw.id,
        draftId: ready.draft.id,
        expectedVersion: ready.draft.version,
        systemOverride: 'round_robin',
      })
      generationIds.push(updated.draft.id)
      ready = { draft: updated.draft }
    }

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

    const holderToken = 'remaining-holder'
    await acquireMatSession(1, holderToken)

    const snapshot = await getMatControlSnapshot(1)
    const bout = pickRunnableBout(snapshot)

    const redEntryId =
      bout.sideA.kind === 'athlete' ? bout.sideA.entryId : bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
    const blueEntryId =
      bout.sideB.kind === 'athlete' ? bout.sideB.entryId : bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
    if (!redEntryId || !blueEntryId) throw new Error('Participants missing')

    const schedulePhase =
      bout.schedulePhase === 'bronze' ||
      bout.schedulePhase === 'final' ||
      bout.schedulePhase === 'round_robin'
        ? bout.schedulePhase
        : 'elimination'

    const periodDurationMs =
      resolveBoutDurationMinutes({
        categoryKey: publishedDraw.categoryKey,
        overrides: {},
      }) * 60_000

    return {
      boutId: bout.id,
      redEntryId,
      blueEntryId,
      holderToken,
      categoryKey: publishedDraw.categoryKey,
      systemId: input?.roundRobin ? 'round_robin' : (publishedDraw.autoSystemId ?? 'olympic'),
      publishedGenerationId: published.publishedGenerationId,
      schedulePhase,
      periodDurationMs,
    }
  }

  async function readScheduleVersion() {
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    return settings.scheduleVersion
  }

  async function runCommand(
    fixture: Awaited<ReturnType<typeof seedReleasedCategory>>,
    state: { revision: number; attemptNumber?: number },
    operationId: string,
    intent: ControlIntent,
    payload: Record<string, unknown> = {},
    boutId = fixture.boutId,
  ) {
    const response = (await executeMatControlCommand({
      boutId,
      envelope: {
        operationId,
        holderToken: fixture.holderToken,
        expectedLiveRevision: state.revision,
        expectedAttemptNumber: state.attemptNumber ?? 1,
      },
      intent,
      payload,
      expectedScheduleVersion: await readScheduleVersion(),
    })) as { liveRevision?: number; ok?: boolean }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }
    return response
  }

  async function confirmBoutQuick(fixture: Awaited<ReturnType<typeof seedReleasedCategory>>, state: { revision: number }) {
    await runCommand(fixture, state, `pre-red-${state.revision}`, 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, `pre-blue-${state.revision}`, 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, `pre-start-${state.revision}`, 'CLOCK_START')
    await runCommand(fixture, state, `pre-score-${state.revision}`, 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, `pre-stop-${state.revision}`, 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, `pre-confirm-${state.revision}`, 'CONFIRM', {})
  }

  it('replays committed operationId after takeover without lease check', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    const first = await runCommand(fixture, state, 'op-replay-shared', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await takeoverMatSession(1, 'holder-b')

    const replay = await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-replay-shared',
        holderToken: 'remaining-holder',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })

    expect(replay).toEqual(first)
    await expect(
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'op-new-after-takeover',
          holderToken: 'remaining-holder',
          expectedLiveRevision: state.revision,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.blueEntryId, corner: 'blue' },
      }),
    ).rejects.toBeInstanceOf(LeaseNotHeldError)
  })

  it('rejects expired lease and allows takeover recovery', async () => {
    const fixture = await seedReleasedCategory()

    await prisma.matControlSession.updateMany({
      where: { matIndex: 1 },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    })

    await expect(
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'op-expired',
          holderToken: fixture.holderToken,
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.redEntryId, corner: 'red' },
      }),
    ).rejects.toBeInstanceOf(LeaseStaleError)

    await takeoverMatSession(1, 'holder-recovered')

    const response = (await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-after-recovery',
        holderToken: 'holder-recovered',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })) as { ok?: boolean }

    expect(response.ok).toBe(true)
  })

  it('completes in-flight mutation before takeover when mutation reserved first', async () => {
    const fixture = await seedReleasedCategory()
    const operationId = 'op-inflight-reserved'

    const mutationPromise = executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId,
        holderToken: fixture.holderToken,
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })

    await waitForCommandReservation(fixture.boutId, operationId)

    const takeoverPromise = takeoverMatSession(1, 'holder-b')
    const mutationResult = (await mutationPromise) as { ok?: boolean }
    await takeoverPromise

    expect(mutationResult.ok).toBe(true)
    await expect(
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'op-after-inflight',
          holderToken: fixture.holderToken,
          expectedLiveRevision: 1,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.blueEntryId, corner: 'blue' },
      }),
    ).rejects.toBeInstanceOf(LeaseNotHeldError)
  })

  function runnableMatBouts(snapshot: Awaited<ReturnType<typeof getMatControlSnapshot>>) {
    return [
      snapshot.queue.nextAvailable?.bout,
      ...snapshot.queue.upcoming.map((entry) => entry.bout),
    ].filter(
      (bout): bout is InternalBout =>
        Boolean(bout && bout.sideA.kind === 'athlete' && bout.sideB.kind === 'athlete'),
    )
  }

  async function boutCommandState(boutId: string) {
    const execution = await prisma.boutScheduleExecution.findUnique({ where: { boutId } })
    return {
      revision: execution?.liveRevision ?? 0,
      attemptNumber: execution?.attemptNumber ?? 1,
    }
  }

  async function confirmRunnableBout(
    fixture: Awaited<ReturnType<typeof seedReleasedCategory>>,
    bout: InternalBout,
    label: string,
  ) {
    const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
    const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
    if (!redEntryId || !blueEntryId) throw new Error('Participants missing')

    const state = await boutCommandState(bout.id)
    await runCommand(fixture, state, `${label}-red`, 'FIRST_CALL', { entryId: redEntryId, corner: 'red' }, bout.id)
    await runCommand(fixture, state, `${label}-blue`, 'FIRST_CALL', { entryId: blueEntryId, corner: 'blue' }, bout.id)
    await runCommand(fixture, state, `${label}-start`, 'CLOCK_START', {}, bout.id)
    await runCommand(fixture, state, `${label}-score`, 'TECHNICAL_SCORE', {
      entryId: redEntryId,
      corner: 'red',
      points: 4,
    }, bout.id)
    await runCommand(fixture, state, `${label}-stop`, 'STOPPAGE_CLEAR_ADVANTAGE', { winnerCorner: 'red' }, bout.id)
    await runCommand(fixture, state, `${label}-confirm`, 'CONFIRM', {}, bout.id)
  }

  it('blocks branch recovery while downstream bout is live', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 4 })
    const state = { revision: 0 }

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const structure = deserializePublishedStructure(draw?.publishedStructureJson)
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey: fixture.categoryKey,
      categoryTitle: draw?.categoryTitle ?? '',
      discipline: draw?.discipline ?? 'tactic_control',
      storedMatIndex: 1,
      competitionStage: draw?.competitionStage ?? 1,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(fixture.boutId, categoryBouts)
    expect(downstreamBoutIds.length).toBeGreaterThan(0)

    await confirmBoutQuick(fixture, state)

    await prisma.boutScheduleExecution.upsert({
      where: { boutId: downstreamBoutIds[0]! },
      create: {
        ...createDefaultExecutionData(downstreamBoutIds[0]!),
        boutPhase: 'live',
        clockState: 'running',
      },
      update: { boutPhase: 'live', clockState: 'running' },
    })

    await expect(
      applyBoutResultCorrection({
        boutId: fixture.boutId,
        operationId: 'corr-blocked-live',
        reason: 'Пересмотр',
        requestedBy: 'admin',
        newWinnerEntryId: fixture.blueEntryId,
        newLoserEntryId: fixture.redEntryId,
        systemId: fixture.systemId,
        categoryKey: fixture.categoryKey,
        schedulePhase: fixture.schedulePhase,
        downstreamBoutIds,
      }),
    ).rejects.toBeInstanceOf(CorrectionBlockedError)
  })

  it('serializes parallel correction apply and downstream pre-fight start', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const structure = deserializePublishedStructure(draw?.publishedStructureJson)
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey: fixture.categoryKey,
      categoryTitle: draw?.categoryTitle ?? '',
      discipline: draw?.discipline ?? 'tactic_control',
      storedMatIndex: 1,
      competitionStage: draw?.competitionStage ?? 1,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(fixture.boutId, categoryBouts)

    await confirmBoutQuick(fixture, state)

    const afterConfirm = await getMatControlSnapshot(1)
    const downstreamBout = runnableMatBouts(afterConfirm)[0]
    expect(downstreamBout).toBeTruthy()

    const downstreamRed =
      downstreamBout!.sideA.kind === 'athlete' ? downstreamBout!.sideA.entryId : null
    const downstreamBlue =
      downstreamBout!.sideB.kind === 'athlete' ? downstreamBout!.sideB.entryId : null
    if (!downstreamRed || !downstreamBlue) throw new Error('Downstream participants missing')

    const preview = await previewBoutResultCorrection({
      boutId: fixture.boutId,
      newWinnerEntryId: fixture.blueEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      downstreamBoutIds,
    })
    expect(preview.blocked).toBe(false)

    const [correctionResult, downstreamResult] = await Promise.allSettled([
      applyBoutResultCorrection({
        boutId: fixture.boutId,
        operationId: 'corr-parallel',
        reason: 'Параллельная коррекция',
        requestedBy: 'admin',
        newWinnerEntryId: fixture.blueEntryId,
        newLoserEntryId: fixture.redEntryId,
        systemId: fixture.systemId,
        categoryKey: fixture.categoryKey,
        schedulePhase: fixture.schedulePhase,
        downstreamBoutIds,
      }),
      executeMatControlCommand({
        boutId: downstreamBout!.id,
        envelope: {
          operationId: 'down-parallel',
          holderToken: fixture.holderToken,
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: downstreamRed, corner: 'red' },
        expectedScheduleVersion: await readScheduleVersion(),
      }),
    ])

    expect(correctionResult.status).toBe('fulfilled')
    expect(['fulfilled', 'rejected']).toContain(downstreamResult.status)

    const currentResults = await prisma.boutResult.count({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(currentResults).toBe(1)
  })

  it('postpones bout after anchor on mat', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 8 })
    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.pendingMatBoutIds.length).toBeGreaterThanOrEqual(2)

    const postponedId = snapshot.session.activeBoutId
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

    const publicationState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixture.categoryKey },
    })
    const overrides = (publicationState?.scheduleOverrides ?? {}) as Record<
      string,
      { queueAfterBoutId?: string }
    >
    expect(overrides[postponedId]?.queueAfterBoutId).toBe(result.postponeAfterBoutId)
  })

  it('keeps postpone anchor order across mat control snapshot reload', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 8 })
    const snapshot = await getMatControlSnapshot(1)
    const postponedId = snapshot.session.activeBoutId
    if (!postponedId) throw new Error('Active bout missing')

    const postponed = await postponeBoutOnMat({
      boutId: postponedId,
      postponeBy: 1,
      holderToken: fixture.holderToken,
      expectedLiveRevision: 0,
      expectedAttemptNumber: 1,
      expectedScheduleVersion: await readScheduleVersion(),
    })

    const firstOrder = (await getMatControlSnapshot(1)).pendingMatBoutIds
    const secondOrder = (await getMatControlSnapshot(1)).pendingMatBoutIds
    expect(firstOrder).toEqual(secondOrder)
    expect(firstOrder.indexOf(postponedId)).toBeGreaterThan(
      firstOrder.indexOf(postponed.postponeAfterBoutId!),
    )

    const publicationState = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: fixture.categoryKey },
    })
    const overrides = (publicationState?.scheduleOverrides ?? {}) as Record<
      string,
      { queueAfterBoutId?: string }
    >
    expect(overrides[postponedId]?.queueAfterBoutId).toBe(postponed.postponeAfterBoutId)
  })

  async function advanceToPendingActivityDecision(
    fixture: Awaited<ReturnType<typeof seedReleasedCategory>>,
    state: { revision: number },
  ) {
    await runCommand(fixture, state, 'tb-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'tb-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'tb-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: fixture.boutId,
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: 'tb-main-tie',
    })
    await runCommand(fixture, state, 'tb-main-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -fixture.periodDurationMs,
    })
    await runCommand(fixture, state, 'tb-main-expire', 'EXPIRE_PERIOD', { period: 'main' })
    await runCommand(fixture, state, 'tb-extra-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: fixture.boutId,
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: 'tb-extra-tie',
    })
    await runCommand(fixture, state, 'tb-extra-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -fixture.periodDurationMs,
    })
    await runCommand(fixture, state, 'tb-extra-expire', 'EXPIRE_PERIOD', { period: 'extra' })
  }

  it('runs tie-break extra activity decision and confirms winner', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await advanceToPendingActivityDecision(fixture, state)

    const execution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(execution?.boutPhase).toBe('pending_activity_decision')

    await runCommand(fixture, state, 'tb-decide', 'EXTRA_ACTIVITY_DECIDE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'tb-confirm', 'CONFIRM', {})

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)
  })

  it('confirms submission on arm with formatted victory label', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'sub-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'sub-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'sub-start', 'CLOCK_START')
    await runCommand(fixture, state, 'sub-stop', 'STOPPAGE_SUBMISSION', {
      winnerCorner: 'red',
      submissionSubtype: 'ARM',
    })
    await runCommand(fixture, state, 'sub-confirm', 'CONFIRM', {})

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.victoryMethod).toBe('SUBMISSION')

    const events = await prisma.boutEvent.findMany({ where: { boutId: fixture.boutId } })
    const summary = buildBoutConfirmationSummary({
      events: events.map((row) => ({
        ...row,
        payload: row.payload as Record<string, unknown> | null,
      })) as import('../mat-control/types').BoutEventRecord[],
      decision: {
        winnerEntryId: fixture.redEntryId,
        loserEntryId: fixture.blueEntryId,
        reason: 'SUBMISSION',
        decidedInPeriod: 'main',
        details: { submissionSubtype: 'ARM' },
      },
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redName: 'Red',
      blueName: 'Blue',
      mainRedScore: result?.mainRedScore ?? 0,
      mainBlueScore: result?.mainBlueScore ?? 0,
    })
    expect(summary.victoryMethodLabel).toBe('Б.П. (рука)')
  })

  it('applies round-robin correction and updates standings in structure', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 5, roundRobin: true })
    const state = { revision: 0 }
    await confirmBoutQuick(fixture, state)

    const drawBefore = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const before = deserializePublishedStructure(drawBefore?.publishedStructureJson)
    const winnerBefore = before?.structure.roundRobinStandings?.find(
      (row) => row.entryId === fixture.redEntryId,
    )?.wins

    const correction = await applyBoutResultCorrection({
      boutId: fixture.boutId,
      operationId: 'corr-round-robin',
      reason: 'Смена победителя RR',
      requestedBy: 'admin',
      newWinnerEntryId: fixture.blueEntryId,
      newLoserEntryId: fixture.redEntryId,
      systemId: 'round_robin',
      categoryKey: fixture.categoryKey,
      schedulePhase: 'round_robin',
      downstreamBoutIds: [],
    })
    expect(correction.correctionMode).toBe('SAFE_CASCADE')

    const drawAfter = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const after = deserializePublishedStructure(drawAfter?.publishedStructureJson)
    const winnerAfter = after?.structure.roundRobinStandings?.find(
      (row) => row.entryId === fixture.blueEntryId,
    )?.wins
    const loserAfter = after?.structure.roundRobinStandings?.find(
      (row) => row.entryId === fixture.redEntryId,
    )?.wins

    expect(winnerAfter).toBe(1)
    expect(loserAfter).toBe(0)
    if (winnerBefore != null) {
      expect(winnerBefore).toBe(1)
    }
  })

  async function seedDualMatReleasedBouts() {
    const first = await seedPaidPairInCategory('w_66', 'dual-a')
    const second = await seedPaidPairInCategory('w_73', 'dual-b')
    registrationIds.push(first.registrationId, second.registrationId)
    entryIds.push(...first.entryIds, ...second.entryIds)

    const firstCategoryKey = getRegistrationCategoryKey({
      discipline: 'tactic_control',
      experienceLevel: 'beginner',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'w_66',
    })
    const secondCategoryKey = getRegistrationCategoryKey({
      discipline: 'tactic_control',
      experienceLevel: 'beginner',
      ageDivisionId: 'm_juniors_1',
      weightCategoryId: 'w_73',
    })

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)
    const draws = await prisma.bracketCategoryDraw.findMany({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
      orderBy: { categoryKey: 'asc' },
    })
    expect(draws.length).toBeGreaterThanOrEqual(2)

    let version = ready.draft.version
    const matAssignments = [
      { draw: draws.find((draw) => draw.categoryKey === firstCategoryKey) ?? draws[0]!, matIndex: 1 },
      { draw: draws.find((draw) => draw.categoryKey === secondCategoryKey) ?? draws[1]!, matIndex: 2 },
    ]
    for (const assignment of matAssignments) {
      const matUpdate = await updateBracketDrawMatIndex({
        drawId: assignment.draw.id,
        draftId: ready.draft.id,
        expectedVersion: version,
        matIndex: assignment.matIndex,
      })
      version = matUpdate.draft.version
    }

    const published = await publishBracketDraft({
      draftId: ready.draft.id,
      expectedVersion: version,
    })
    generationIds.push(published.publishedGenerationId, published.draft.id)

    const fixtures: Array<{
      matIndex: number
      boutId: string
      redEntryId: string
      blueEntryId: string
      holderToken: string
    }> = []

    for (const assignment of matAssignments) {
      const publishedDraw = await prisma.bracketCategoryDraw.findFirst({
        where: {
          generationId: published.publishedGenerationId,
          categoryKey: assignment.draw.categoryKey,
          status: 'ACTIVE',
        },
      })
      if (!publishedDraw) throw new Error('Published draw missing')

      await setCategoriesBoutsReleased({
        scope: 'category',
        categoryKey: publishedDraw.categoryKey,
        released: true,
        expectedPublishedDrawId: publishedDraw.id,
        expectedPublishedGenerationId: published.publishedGenerationId,
      })

      const holderToken = `dual-holder-${assignment.matIndex}`
      await acquireMatSession(assignment.matIndex, holderToken)
      const snapshot = await getMatControlSnapshot(assignment.matIndex)
      const bout = pickRunnableBout(snapshot)
      const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
      const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
      if (!redEntryId || !blueEntryId) throw new Error('Participants missing')

      fixtures.push({
        matIndex: assignment.matIndex,
        boutId: bout.id,
        redEntryId,
        blueEntryId,
        holderToken,
      })
    }

    return fixtures
  }

  async function runToPendingConfirmation(
    fixture: {
      boutId: string
      redEntryId: string
      blueEntryId: string
      holderToken: string
    },
    label: string,
  ) {
    const state = await boutCommandState(fixture.boutId)
    await runCommand(fixture, state, `${label}-red`, 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, `${label}-blue`, 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, `${label}-start`, 'CLOCK_START')
    await runCommand(fixture, state, `${label}-score`, 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, `${label}-stop`, 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    return state
  }

  it('allows parallel confirm on independent mats without cross-interference', async () => {
    const [mat1, mat2] = await seedDualMatReleasedBouts()

    const state1 = await runToPendingConfirmation(mat1, 'm1')
    const state2 = await runToPendingConfirmation(mat2, 'm2')

    const confirm1 = await executeMatControlCommand({
      boutId: mat1.boutId,
      envelope: {
        operationId: 'dual-confirm-1',
        holderToken: mat1.holderToken,
        expectedLiveRevision: state1.revision,
        expectedAttemptNumber: 1,
      },
      intent: 'CONFIRM',
      payload: {},
      expectedScheduleVersion: await readScheduleVersion(),
    })
    const confirm2 = await executeMatControlCommand({
      boutId: mat2.boutId,
      envelope: {
        operationId: 'dual-confirm-2',
        holderToken: mat2.holderToken,
        expectedLiveRevision: state2.revision,
        expectedAttemptNumber: 1,
      },
      intent: 'CONFIRM',
      payload: {},
      expectedScheduleVersion: await readScheduleVersion(),
    })

    expect((confirm1 as { ok?: boolean }).ok).toBe(true)
    expect((confirm2 as { ok?: boolean }).ok).toBe(true)
    expect(
      await prisma.boutResult.count({ where: { boutId: mat1.boutId, isCurrent: true } }),
    ).toBe(1)
    expect(
      await prisma.boutResult.count({ where: { boutId: mat2.boutId, isCurrent: true } }),
    ).toBe(1)
  })

  it('rejects undo in pending_confirmation', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'undo-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'undo-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'undo-start', 'CLOCK_START')
    await runCommand(fixture, state, 'undo-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })

    const execution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(execution?.boutPhase).toBe('pending_confirmation')

    await expect(runCommand(fixture, state, 'undo-fail', 'UNDO')).rejects.toBeInstanceOf(
      CommandNotAllowedError,
    )
  })

  it('runs period end correction after cancel stoppage and confirms', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'pec-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'pec-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'pec-start', 'CLOCK_START')
    await runCommand(fixture, state, 'pec-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'pec-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -fixture.periodDurationMs,
    })
    await runCommand(fixture, state, 'pec-expire', 'EXPIRE_PERIOD', { period: 'main' })
    await runCommand(fixture, state, 'pec-cancel', 'CANCEL_STOPPAGE')

    const correcting = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(correcting?.periodCorrectionMode).toBe(true)
    expect(correcting?.boutPhase).toBe('live')

    await runCommand(fixture, state, 'pec-finish', 'FINISH_PERIOD_CORRECTION')

    const afterCorrection = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(afterCorrection?.periodCorrectionMode).toBe(false)
    expect(afterCorrection?.boutPhase).toBe('pending_confirmation')

    await runCommand(fixture, state, 'pec-confirm', 'CONFIRM', {})

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)
  })

  it('restores live score and phase across snapshot refresh', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'ref-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'ref-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'ref-start', 'CLOCK_START')
    await runCommand(fixture, state, 'ref-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 3,
    })

    const first = await getMatControlSnapshot(1)
    const second = await getMatControlSnapshot(1)

    expect(first.activeBout?.execution.boutPhase).toBe('live')
    expect(second.activeBout?.execution.boutPhase).toBe('live')
    expect(first.activeBout?.score.officialScore.red).toBe(3)
    expect(second.activeBout?.score.officialScore.red).toBe(3)
    expect(first.activeBout?.periodRemainingMs).toBeGreaterThan(0)
    expect(second.activeBout?.periodRemainingMs).toBeGreaterThan(0)
    expect(
      Math.abs((first.activeBout?.periodRemainingMs ?? 0) - (second.activeBout?.periodRemainingMs ?? 0)),
    ).toBeLessThan(5_000)
  })

  it('reverts activity decision and allows re-decide after cancel stoppage', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await advanceToPendingActivityDecision(fixture, state)
    await runCommand(fixture, state, 'act-decide-1', 'EXTRA_ACTIVITY_DECIDE', {
      winnerCorner: 'red',
    })

    const afterVote = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(afterVote?.boutPhase).toBe('pending_confirmation')

    await runCommand(fixture, state, 'act-cancel', 'CANCEL_STOPPAGE')

    const reverted = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(reverted?.boutPhase).toBe('pending_activity_decision')

    await runCommand(fixture, state, 'act-decide-2', 'EXTRA_ACTIVITY_DECIDE', {
      winnerCorner: 'blue',
    })
    await runCommand(fixture, state, 'act-confirm', 'CONFIRM', {})

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.blueEntryId)
  })

  it('allows undo after early stoppage cancel', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'esu-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'esu-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'esu-start', 'CLOCK_START')
    await runCommand(fixture, state, 'esu-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 2,
    })
    await runCommand(fixture, state, 'esu-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'esu-cancel', 'CANCEL_STOPPAGE')
    await runCommand(fixture, state, 'esu-undo', 'UNDO')

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.activeBout?.execution.boutPhase).toBe('live')
    expect(snapshot.activeBout?.score.officialScore.red).toBe(0)
  })

  it('rejects extra activity decision during activity correction mode', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await advanceToPendingActivityDecision(fixture, state)
    await runCommand(fixture, state, 'acm-enable', 'CORRECT_BEFORE_ACTIVITY', { enable: true })

    await expect(
      runCommand(fixture, state, 'acm-decide', 'EXTRA_ACTIVITY_DECIDE', {
        winnerCorner: 'red',
      }),
    ).rejects.toBeInstanceOf(CommandNotAllowedError)
  })

  it('confirms forfeit with FORFEIT victory method', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'ff-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'ff-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'ff-start', 'CLOCK_START')
    await runCommand(fixture, state, 'ff-forfeit', 'STOPPAGE_FORFEIT', {
      forfeitingCorner: 'blue',
    })
    await runCommand(fixture, state, 'ff-confirm', 'CONFIRM', {})

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.victoryMethod).toBe('FORFEIT')
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)
  })

  async function advanceToExtraLive(
    fixture: Awaited<ReturnType<typeof seedReleasedCategory>>,
    state: { revision: number },
  ) {
    await runCommand(fixture, state, 'xl-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'xl-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'xl-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: fixture.boutId,
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: 'xl-main-tie',
    })
    await runCommand(fixture, state, 'xl-main-elapsed', 'CLOCK_ADJUST', {
      deltaMs: -fixture.periodDurationMs,
    })
    await runCommand(fixture, state, 'xl-main-expire', 'EXPIRE_PERIOD', { period: 'main' })
    await runCommand(fixture, state, 'xl-extra-start', 'CLOCK_START')
  }

  it('sets officialEndedAt at extra submission time distinct from mainEndedAt', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await advanceToExtraLive(fixture, state)

    const beforeSubmission = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(beforeSubmission?.currentPeriod).toBe('extra')
    expect(beforeSubmission?.mainEndedAt).not.toBeNull()
    expect(beforeSubmission?.officialEndedAt).toBeNull()

    await runCommand(fixture, state, 'xl-sub', 'STOPPAGE_SUBMISSION', {
      winnerCorner: 'red',
      submissionSubtype: 'ARM',
    })

    const afterSubmission = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(afterSubmission?.boutPhase).toBe('pending_confirmation')
    expect(afterSubmission?.mainEndedAt?.toISOString()).toBe(
      beforeSubmission?.mainEndedAt?.toISOString(),
    )
    expect(afterSubmission?.officialEndedAt?.getTime()).toBeGreaterThan(
      beforeSubmission!.mainEndedAt!.getTime(),
    )
  })

  it('rejects commands when holder lease is for a different mat', async () => {
    const [mat1, mat2] = await seedDualMatReleasedBouts()

    await expect(
      executeMatControlCommand({
        boutId: mat2.boutId,
        envelope: {
          operationId: 'wrong-mat-call',
          holderToken: mat1.holderToken,
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: mat2.redEntryId, corner: 'red' },
      }),
    ).rejects.toBeInstanceOf(LeaseNotHeldError)
  })

  it('rejects undo after bout is confirmed', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }
    await confirmBoutQuick(fixture, state)

    await expect(runCommand(fixture, state, 'undo-confirmed', 'UNDO')).rejects.toBeInstanceOf(
      CommandNotAllowedError,
    )
  })

  it('serializes parallel confirm on same bout in one category', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 4 })
    const state = { revision: 0 }

    await runCommand(fixture, state, 'pc-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'pc-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'pc-start', 'CLOCK_START')
    await runCommand(fixture, state, 'pc-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'pc-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })

    const staleRevision = state.revision
    const results = await Promise.allSettled([
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'pc-confirm-a',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'CONFIRM',
        payload: {},
      }),
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'pc-confirm-b',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'CONFIRM',
        payload: {},
      }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect(rejected[0]?.reason).toBeInstanceOf(StaleLiveRevisionError)
    expect(
      await prisma.boutResult.count({ where: { boutId: fixture.boutId, isCurrent: true } }),
    ).toBe(1)
  })

  it('focusMatBout switches active bout within mat queue', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 4 })
    const snapshot = await getMatControlSnapshot(1)
    const altBoutId = snapshot.pendingMatBoutIds.find((boutId) => boutId !== fixture.boutId)
    expect(altBoutId).toBeTruthy()

    const focused = await focusMatBout({
      matIndex: 1,
      boutId: altBoutId!,
      holderToken: fixture.holderToken,
    })

    expect(focused.session.activeBoutId).toBe(altBoutId)
    expect(focused.activeBout?.boutId).toBe(altBoutId)
    expect(focused.activeBout?.execution.boutPhase).toBe('scheduled')

    const refreshed = await getMatControlSnapshot(1)
    expect(refreshed.session.activeBoutId).toBe(altBoutId)
    expect(refreshed.activeBout?.boutId).toBe(altBoutId)
  })

  it('swaps corners during live bout via CORNER_SWAP', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'swap-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'swap-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'swap-start', 'CLOCK_START')
    await runCommand(fixture, state, 'swap-corners', 'CORNER_SWAP')

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.activeBout?.participants.cornersSwapped).toBe(true)

    const swapEvents = await prisma.boutEvent.findMany({
      where: { boutId: fixture.boutId, eventType: 'CORNER_SWAP', undoneAt: null },
    })
    expect(swapEvents).toHaveLength(1)
  })

  it('records passivity start and end during live bout', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'pass-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'pass-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'pass-start', 'CLOCK_START')
    await runCommand(fixture, state, 'pass-on', 'PASSIVITY_START', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'pass-off', 'PASSIVITY_END', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })

    const events = await prisma.boutEvent.findMany({
      where: {
        boutId: fixture.boutId,
        eventType: { in: ['PASSIVITY_START', 'PASSIVITY_END'] },
        undoneAt: null,
      },
      orderBy: { createdAt: 'asc' },
    })
    expect(events.map((event) => event.eventType)).toEqual(['PASSIVITY_START', 'PASSIVITY_END'])
  })

  it('OPEN_NEXT_BOUT advances session to the next pending bout', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 4 })
    const state = { revision: 0 }
    await confirmBoutQuick(fixture, state)

    const before = await getMatControlSnapshot(1)
    expect(before.activeBout?.execution.boutPhase).toBe('confirmed')
    const nextBoutId =
      before.queue.nextAvailable?.bout.id ??
      before.queue.upcoming.find((entry) => entry.bout.id !== fixture.boutId)?.bout.id
    expect(nextBoutId).toBeTruthy()

    await runCommand(fixture, state, 'open-next', 'OPEN_NEXT_BOUT')

    const after = await getMatControlSnapshot(1)
    expect(after.session.activeBoutId).toBe(nextBoutId)
    expect(after.activeBout?.boutId).toBe(nextBoutId)
    expect(after.activeBout?.execution.boutPhase).toBe('scheduled')
  })

  it('propagates winner and exposes next bout after confirm', async () => {
    const fixture = await seedReleasedCategory({ participantCount: 4 })
    const state = { revision: 0 }

    await confirmBoutQuick(fixture, state)

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const structure = deserializePublishedStructure(draw?.publishedStructureJson)
    const localMatchId = fixture.boutId.includes('::')
      ? fixture.boutId.slice(fixture.boutId.indexOf('::') + 2)
      : fixture.boutId
    const propagated = structure?.structure.rounds.some(
      (match) =>
        match.participantA?.entryId === fixture.redEntryId ||
        match.participantB?.entryId === fixture.redEntryId ||
        match.slotSourceA?.matchId === localMatchId ||
        match.slotSourceB?.matchId === localMatchId,
    )
    expect(propagated).toBe(true)

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.recentBouts.some((entry) => entry.boutId === fixture.boutId)).toBe(true)
    expect(
      snapshot.queue.nextAvailable?.bout ?? snapshot.queue.upcoming[0]?.bout ?? null,
    ).toBeTruthy()
  })

  it('records adjudication score as technical score for tie-break', async () => {
    const fixture = await seedReleasedCategory()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'adj-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'adj-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'adj-start', 'CLOCK_START')
    await runCommand(fixture, state, 'adj-score', 'ADJUDICATION_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })

    const events = await prisma.boutEvent.findMany({
      where: { boutId: fixture.boutId, eventType: 'TECHNICAL_SCORE' },
    })
    expect(events).toHaveLength(1)
    expect((events[0]?.payload as { source?: string } | null)?.source).toBe('ADJUDICATION')

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.activeBout?.score.officialScore.red).toBe(4)
  })

  it('enriches public bouts with live score during active bout', async () => {
    const seeded = await seedPaidPairInCategory('w_66', 'public-live')
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

    await prisma.boutsPageSetting.update({
      where: { id: 'default' },
      data: { publicEnabled: true },
    })

    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: publishedDraw.categoryKey,
      released: true,
      expectedPublishedDrawId: publishedDraw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })

    await acquireMatSession(1, 'public-live-holder')
    const snapshot = await getMatControlSnapshot(1)
    const bout = pickRunnableBout(snapshot)
    const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
    const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
    if (!redEntryId || !blueEntryId) throw new Error('Participants missing')

    const state = { revision: 0 }
    const fixture = {
      boutId: bout.id,
      redEntryId,
      blueEntryId,
      holderToken: 'public-live-holder',
    }

    await runCommand(fixture, state, 'pub-red', 'FIRST_CALL', { entryId: redEntryId, corner: 'red' })
    await runCommand(fixture, state, 'pub-blue', 'FIRST_CALL', { entryId: blueEntryId, corner: 'blue' })
    await runCommand(fixture, state, 'pub-start', 'CLOCK_START')
    await runCommand(fixture, state, 'pub-score', 'TECHNICAL_SCORE', {
      entryId: redEntryId,
      corner: 'red',
      points: 3,
    })

    const publicBouts = await getPublicBouts()
    expect(publicBouts).not.toBeNull()
    const liveBout = publicBouts!.mats
      .flatMap((mat) => mat.bouts)
      .find((entry) => entry.id === bout.id)
    expect(liveBout?.timing?.liveScore).toMatchObject({
      red: 3,
      blue: 0,
      boutPhase: 'live',
    })
  })
})
