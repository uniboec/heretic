import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex } from '../mutations'
import { deserializePublishedStructure } from '../../brackets/core/snapshot'
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
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import {
  applyBoutResultCorrection,
  previewBoutResultCorrection,
} from '../applyBoutResultCorrection'
import { FirstCallAlreadyRecordedError, IdempotencyKeyReusedError } from '../mat-control/errors'
import type { ControlIntent } from '../mat-control/types'
import { extractBouts } from '../extractBouts'
import { resolveDownstreamBoutIds } from '../sportDependencies'
import type { InternalBout } from '../types'
import { insertSharedEpisodeTie } from './helpers/runSharedEpisodeTie'
import {
  fastForwardCurrentPeriod,
  resolvePeriodDurationMsForCategory,
} from './helpers/matControlPeriodHelpers'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
} from '../matControlService'

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

type MatControlFixture = {
  boutId: string
  redEntryId: string
  blueEntryId: string
  holderToken: string
  categoryKey: string
  systemId: string
  publishedGenerationId: string
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
  periodDurationMs: number
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
  if (!bout) {
    throw new Error('Bout participants missing')
  }
  return bout
}

describe('mat control integration', () => {
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

  async function seedReleasedBoutOnMat1(input?: {
    seedCategory?: () => Promise<{ registrationIds: string[]; entryIds: string[]; categoryKey: string }>
  }): Promise<MatControlFixture> {
    const seeded = input?.seedCategory
      ? await input.seedCategory()
      : await (async () => {
          const pair = await seedPaidPairInCategory('w_66', 'mat-control')
          return {
            registrationIds: [pair.registrationId],
            entryIds: pair.entryIds,
            categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
          }
        })()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const draftDraw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: ready.draft.id, status: 'ACTIVE' },
    })
    if (!draftDraw) {
      throw new Error('Draft draw missing')
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
    if (!publishedDraw) {
      throw new Error('Published draw missing')
    }

    await setCategoriesBoutsReleased({
      scope: 'category',
      categoryKey: publishedDraw.categoryKey,
      released: true,
      expectedPublishedDrawId: publishedDraw.id,
      expectedPublishedGenerationId: published.publishedGenerationId,
    })

    const holderToken = 'integration-holder-token'
    await acquireMatSession(1, holderToken)

    const snapshot = await getMatControlSnapshot(1)
    const bout = pickRunnableBout(snapshot)

    const redEntryId =
      bout.sideA.kind === 'athlete'
        ? bout.sideA.entryId
        : bout.sideB.kind === 'athlete'
          ? bout.sideB.entryId
          : null
    const blueEntryId =
      bout.sideB.kind === 'athlete'
        ? bout.sideB.entryId
        : bout.sideA.kind === 'athlete'
          ? bout.sideA.entryId
          : null
    if (!redEntryId || !blueEntryId) {
      throw new Error('Bout participants missing')
    }

    const schedulePhase =
      bout.schedulePhase === 'bronze' ||
      bout.schedulePhase === 'final' ||
      bout.schedulePhase === 'round_robin'
        ? bout.schedulePhase
        : 'elimination'

    const periodDurationMs = await resolvePeriodDurationMsForCategory(publishedDraw.categoryKey)

    return {
      boutId: bout.id,
      redEntryId,
      blueEntryId,
      holderToken,
      categoryKey: publishedDraw.categoryKey,
      systemId: publishedDraw.autoSystemId ?? 'olympic',
      publishedGenerationId: published.publishedGenerationId,
      schedulePhase,
      periodDurationMs,
    }
  }

  async function advanceToPendingActivityDecision(fixture: MatControlFixture, state: { revision: number }) {
    await runCommand(fixture, state, 'op-int-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-int-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-int-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: fixture.boutId,
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: 'op-int-main-tie',
    })
    await fastForwardCurrentPeriod({
      runCommand: (operationId, intent, payload) =>
        runCommand(fixture, state, operationId, intent, payload),
      periodDurationMs: fixture.periodDurationMs,
      operationIdPrefix: 'op-int-main',
    })
    await runCommand(fixture, state, 'op-int-main-expire', 'EXPIRE_PERIOD', {
      period: 'main',
    })
    await runCommand(fixture, state, 'op-int-extra-start', 'CLOCK_START')
    state.revision = await insertSharedEpisodeTie({
      boutId: fixture.boutId,
      redEntryId: fixture.redEntryId,
      blueEntryId: fixture.blueEntryId,
      redPoints: 2,
      bluePoints: 2,
      operationId: 'op-int-extra-tie',
    })
    await fastForwardCurrentPeriod({
      runCommand: (operationId, intent, payload) =>
        runCommand(fixture, state, operationId, intent, payload),
      periodDurationMs: fixture.periodDurationMs,
      operationIdPrefix: 'op-int-extra',
    })
    await runCommand(fixture, state, 'op-int-extra-expire', 'EXPIRE_PERIOD', {
      period: 'extra',
    })
  }

  async function readScheduleVersion() {
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    return settings.scheduleVersion
  }

  async function runCommand(
    fixture: MatControlFixture,
    state: { revision: number },
    operationId: string,
    intent: ControlIntent,
    payload: Record<string, unknown> = {},
  ) {
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
    })) as { liveRevision?: number; ok?: boolean }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }

    return response
  }

  it('runs acquire → calls → fight → score → confirm → BoutResult', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-first-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-first-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-clock-start', 'CLOCK_START')
    await runCommand(fixture, state, 'op-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'op-stoppage', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    const confirm = await runCommand(fixture, state, 'op-confirm', 'CONFIRM')

    expect(confirm.ok).toBe(true)

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)
    expect(result?.mainRedScore).toBeGreaterThanOrEqual(4)

    const snapshot = await getMatControlSnapshot(1)
    expect(snapshot.recentBouts.some((entry) => entry.boutId === fixture.boutId)).toBe(true)
    expect(snapshot.session.activeBoutId).toBe(fixture.boutId)
    expect(snapshot.activeBout?.execution.boutPhase).toBe('confirmed')
  })

  it('replays same operationId without duplicate events', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const envelope = {
      operationId: 'op-idempotent',
      holderToken: fixture.holderToken,
      expectedLiveRevision: 0,
      expectedAttemptNumber: 1,
    }

    const first = await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope,
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })
    const second = await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope,
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })

    expect(second).toEqual(first)
    expect(await prisma.boutEvent.count({ where: { boutId: fixture.boutId } })).toBe(1)
  })

  it('rejects operationId reuse with different payload', async () => {
    const fixture = await seedReleasedBoutOnMat1()

    await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-conflict',
        holderToken: fixture.holderToken,
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'FIRST_CALL',
      payload: { entryId: fixture.redEntryId, corner: 'red' },
    })

    await expect(
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'op-conflict',
          holderToken: fixture.holderToken,
          expectedLiveRevision: 1,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.blueEntryId, corner: 'blue' },
      }),
    ).rejects.toBeInstanceOf(IdempotencyKeyReusedError)
  })

  it('applies metadata-only result correction in database', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-first-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-first-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-clock-start', 'CLOCK_START')
    await runCommand(fixture, state, 'op-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 2,
    })
    await runCommand(fixture, state, 'op-stoppage', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'op-confirm', 'CONFIRM')

    const before = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(before).not.toBeNull()

    const correction = await applyBoutResultCorrection({
      boutId: fixture.boutId,
      operationId: 'corr-metadata',
      reason: 'Уточнение основания',
      requestedBy: 'admin',
      newWinnerEntryId: fixture.redEntryId,
      newLoserEntryId: fixture.blueEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      schedulePhase: fixture.schedulePhase,
      downstreamBoutIds: [],
    })

    expect(correction.correctionMode).toBe('METADATA_ONLY')

    const after = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(after?.id).toBe(before?.id)
    expect(after?.decisionReason).toBe('Уточнение основания')
  })

  it('finishes activity correction without voting and confirms winner', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await advanceToPendingActivityDecision(fixture, state)

    const beforeCorrection = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(beforeCorrection?.boutPhase).toBe('pending_activity_decision')

    await runCommand(fixture, state, 'op-act-enter', 'CORRECT_BEFORE_ACTIVITY', { enable: true })
    await runCommand(fixture, state, 'op-act-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 2,
    })
    await runCommand(fixture, state, 'op-act-finish', 'FINISH_ACTIVITY_CORRECTION')
    await runCommand(fixture, state, 'op-act-confirm', 'CONFIRM')

    const result = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(result?.winnerEntryId).toBe(fixture.redEntryId)

    const execution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(execution?.boutPhase).toBe('confirmed')
    expect(execution?.officialEndedAt?.toISOString()).toBe(
      beforeCorrection?.officialEndedAt?.toISOString(),
    )
  })

  it('propagates confirmed winner into published bracket structure', async () => {
    const fixture = await seedReleasedBoutOnMat1({
      seedCategory: async () => {
        const seeded = await seedCategoryWithAthletes({
          participantCount: 4,
          weightCategoryId: 'w_66',
        })
        return {
          registrationIds: seeded.registrationIds,
          entryIds: seeded.entryIds,
          categoryKey: seeded.categoryKey,
        }
      },
    })
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-br-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-br-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-br-start', 'CLOCK_START')
    await runCommand(fixture, state, 'op-br-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'op-br-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'op-br-confirm', 'CONFIRM')

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    expect(draw?.publishedStructureJson).toBeTruthy()

    const snapshot = deserializePublishedStructure(draw?.publishedStructureJson)
    const localMatchId = fixture.boutId.includes('::')
      ? fixture.boutId.slice(fixture.boutId.indexOf('::') + 2)
      : fixture.boutId
    const propagated = snapshot?.structure.rounds.some(
      (match) =>
        match.participantA?.entryId === fixture.redEntryId ||
        match.participantB?.entryId === fixture.redEntryId ||
        match.slotSourceA?.matchId === localMatchId ||
        match.slotSourceB?.matchId === localMatchId,
    )
    expect(propagated).toBe(true)
  })

  it('replays EXPIRE_PERIOD with stale revision after period already ended', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-exp-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-exp-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-exp-start', 'CLOCK_START')
    await fastForwardCurrentPeriod({
      runCommand: (operationId, intent, payload) =>
        runCommand(fixture, state, operationId, intent, payload),
      periodDurationMs: fixture.periodDurationMs,
      operationIdPrefix: 'op-exp',
    })

    const staleRevision = state.revision
    const first = (await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-expire-a',
        holderToken: fixture.holderToken,
        expectedLiveRevision: staleRevision,
        expectedAttemptNumber: 1,
      },
      intent: 'EXPIRE_PERIOD',
      payload: { period: 'main' },
    })) as { ok?: boolean; liveRevision?: number; alreadyProcessed?: boolean }

    const second = (await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-expire-b',
        holderToken: fixture.holderToken,
        expectedLiveRevision: staleRevision,
        expectedAttemptNumber: 1,
      },
      intent: 'EXPIRE_PERIOD',
      payload: { period: 'main' },
    })) as { ok?: boolean; liveRevision?: number; alreadyProcessed?: boolean }

    expect(first.ok).toBe(true)
    expect(first.alreadyProcessed).toBe(false)
    expect(second.ok).toBe(true)
    expect(second.alreadyProcessed).toBe(true)
    expect(second.liveRevision).toBe(first.liveRevision)
    expect(
      await prisma.boutEvent.count({
        where: { boutId: fixture.boutId, eventType: 'PERIOD_ENDED' },
      }),
    ).toBe(1)
  })

  it('applies SAFE_CASCADE correction by resetting source execution', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-sc-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-sc-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-sc-start', 'CLOCK_START')
    await runCommand(fixture, state, 'op-sc-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 3,
    })
    await runCommand(fixture, state, 'op-sc-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'op-sc-confirm', 'CONFIRM')

    const preview = await previewBoutResultCorrection({
      boutId: fixture.boutId,
      newWinnerEntryId: fixture.blueEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      downstreamBoutIds: [],
    })
    expect(preview.correctionMode).toBe('SAFE_CASCADE')

    const correction = await applyBoutResultCorrection({
      boutId: fixture.boutId,
      operationId: 'corr-safe-cascade',
      reason: 'Смена победителя',
      requestedBy: 'admin',
      newWinnerEntryId: fixture.blueEntryId,
      newLoserEntryId: fixture.redEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      schedulePhase: fixture.schedulePhase,
      downstreamBoutIds: [],
    })
    expect(correction.correctionMode).toBe('SAFE_CASCADE')

    const execution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(execution?.boutPhase).toBe('scheduled')
    expect(execution?.attemptNumber).toBeGreaterThan(1)

    const current = await prisma.boutResult.findFirst({
      where: { boutId: fixture.boutId, isCurrent: true },
    })
    expect(current?.winnerEntryId).toBe(fixture.blueEntryId)
  })

  it('applies BRANCH_RECOVERY correction and resets downstream executions', async () => {
    const fixture = await seedReleasedBoutOnMat1({
      seedCategory: async () => {
        const seeded = await seedCategoryWithAthletes({
          participantCount: 4,
          weightCategoryId: 'w_66',
        })
        return {
          registrationIds: seeded.registrationIds,
          entryIds: seeded.entryIds,
          categoryKey: seeded.categoryKey,
        }
      },
    })
    const state = { revision: 0 }

    const draw = await prisma.bracketCategoryDraw.findFirst({
      where: { generationId: fixture.publishedGenerationId, status: 'ACTIVE' },
    })
    const structure = deserializePublishedStructure(draw?.publishedStructureJson)
    expect(structure).not.toBeNull()
    const categoryBouts = extractBouts(structure!.structure, {
      categoryKey: fixture.categoryKey,
      categoryTitle: draw?.categoryTitle ?? '',
      discipline: draw?.discipline ?? 'tactic_control',
      storedMatIndex: 1,
      competitionStage: draw?.competitionStage ?? 1,
    })
    const downstreamBoutIds = resolveDownstreamBoutIds(fixture.boutId, categoryBouts)
    expect(downstreamBoutIds.length).toBeGreaterThan(0)

    await runCommand(fixture, state, 'op-br2-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-br2-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-br2-start', 'CLOCK_START')
    await runCommand(fixture, state, 'op-br2-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await runCommand(fixture, state, 'op-br2-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })
    await runCommand(fixture, state, 'op-br2-confirm', 'CONFIRM')

    const preview = await previewBoutResultCorrection({
      boutId: fixture.boutId,
      newWinnerEntryId: fixture.blueEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      downstreamBoutIds,
    })
    expect(preview.correctionMode).toBe('BRANCH_RECOVERY')

    const correction = await applyBoutResultCorrection({
      boutId: fixture.boutId,
      operationId: 'corr-branch-recovery',
      reason: 'Пересмотр полуфинала',
      requestedBy: 'admin',
      newWinnerEntryId: fixture.blueEntryId,
      newLoserEntryId: fixture.redEntryId,
      systemId: fixture.systemId,
      categoryKey: fixture.categoryKey,
      schedulePhase: fixture.schedulePhase,
      downstreamBoutIds,
    })
    expect(correction.correctionMode).toBe('BRANCH_RECOVERY')

    expect(correction.invalidatedBoutIds).toEqual(downstreamBoutIds)

    const sourceExecution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: fixture.boutId },
    })
    expect(sourceExecution?.boutPhase).toBe('scheduled')
  })

  it('rejects repeat FIRST_CALL after NO_SHOW revert via command router', async () => {
    const fixture = await seedReleasedBoutOnMat1()
    const state = { revision: 0 }

    await runCommand(fixture, state, 'op-ns-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-ns-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await runCommand(fixture, state, 'op-ns-sec', 'SECONDARY_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })

    const startedAt = await prisma.boutEvent.findFirst({
      where: { boutId: fixture.boutId, eventType: 'SECONDARY_CALL' },
      orderBy: { sequence: 'desc' },
    })
    if (startedAt) {
      await prisma.boutEvent.update({
        where: { id: startedAt.id },
        data: { createdAt: new Date(Date.now() - 121_000) },
      })
    }

    await runCommand(fixture, state, 'op-ns-show', 'NO_SHOW', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await runCommand(fixture, state, 'op-ns-cancel', 'CANCEL_STOPPAGE')

    await expect(
      runCommand(fixture, state, 'op-ns-repeat', 'FIRST_CALL', {
        entryId: fixture.redEntryId,
        corner: 'red',
      }),
    ).rejects.toBeInstanceOf(FirstCallAlreadyRecordedError)
  })
})
