import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex } from '../mutations'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
  seedPaidPairInCategory,
  syncRedrawAll,
} from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import { StaleLiveRevisionError } from '../mat-control/errors'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
} from '../matControlService'
import {
  fastForwardCurrentPeriod,
  resolvePeriodDurationMsForCategory,
} from './helpers/matControlPeriodHelpers'

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

describe('mat control race integration', () => {
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

  async function seedFixture() {
    const seeded = await seedPaidPairInCategory('w_66', 'race')
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

    await acquireMatSession(1, 'race-holder')
    const snapshot = await getMatControlSnapshot(1)
    const bout =
      snapshot.activeBout?.bout ??
      snapshot.queue.nextAvailable?.bout ??
      snapshot.queue.upcoming[0]?.bout
    if (!bout) throw new Error('No bout')

    const redEntryId = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
    const blueEntryId = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
    if (!redEntryId || !blueEntryId) throw new Error('Participants missing')

    const periodDurationMs = await resolvePeriodDurationMsForCategory(publishedDraw.categoryKey)

    return {
      boutId: bout.id,
      redEntryId,
      blueEntryId,
      holderToken: 'race-holder',
      periodDurationMs,
    }
  }

  async function readScheduleVersion() {
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    return settings.scheduleVersion
  }

  async function run(
    fixture: Awaited<ReturnType<typeof seedFixture>>,
    state: { revision: number },
    operationId: string,
    intent: Parameters<typeof executeMatControlCommand>[0]['intent'],
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
    })) as { liveRevision?: number }

    if (typeof response.liveRevision === 'number') {
      state.revision = response.liveRevision
    }
    return response
  }

  it('handles parallel EXPIRE_PERIOD with different operationIds', async () => {
    const fixture = await seedFixture()
    const state = { revision: 0 }

    await run(fixture, state, 'race-start', 'CLOCK_START')
    await fastForwardCurrentPeriod({
      runCommand: (operationId, intent, payload) =>
        run(fixture, state, operationId, intent, payload ?? {}),
      periodDurationMs: fixture.periodDurationMs,
      operationIdPrefix: 'race',
    })

    const staleRevision = state.revision
    const scheduleVersion = await readScheduleVersion()
    const [first, second] = await Promise.all([
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'race-exp-a',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'EXPIRE_PERIOD',
        payload: { period: 'main' },
        expectedScheduleVersion: scheduleVersion,
      }),
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'race-exp-b',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'EXPIRE_PERIOD',
        payload: { period: 'main' },
        expectedScheduleVersion: scheduleVersion,
      }),
    ])

    expect(
      await prisma.boutEvent.count({
        where: { boutId: fixture.boutId, eventType: 'PERIOD_ENDED' },
      }),
    ).toBe(1)

    const responses = [first, second] as Array<{
      ok?: boolean
      alreadyProcessed?: boolean
      liveRevision?: number
    }>
    expect(responses.every((response) => response.ok)).toBe(true)
    expect(responses.filter((response) => response.alreadyProcessed).length).toBe(1)
    expect(responses[0]?.liveRevision).toBe(responses[1]?.liveRevision)
  })

  it('allows only one concurrent CONFIRM to succeed', async () => {
    const fixture = await seedFixture()
    const state = { revision: 0 }

    await run(fixture, state, 'conf-red', 'FIRST_CALL', {
      entryId: fixture.redEntryId,
      corner: 'red',
    })
    await run(fixture, state, 'conf-blue', 'FIRST_CALL', {
      entryId: fixture.blueEntryId,
      corner: 'blue',
    })
    await run(fixture, state, 'conf-start', 'CLOCK_START')
    await run(fixture, state, 'conf-score', 'TECHNICAL_SCORE', {
      entryId: fixture.redEntryId,
      corner: 'red',
      points: 4,
    })
    await run(fixture, state, 'conf-stop', 'STOPPAGE_CLEAR_ADVANTAGE', {
      winnerCorner: 'red',
    })

    const staleRevision = state.revision
    const scheduleVersion = await readScheduleVersion()
    const results = await Promise.allSettled([
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'conf-a',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'CONFIRM',
        payload: {},
        expectedScheduleVersion: scheduleVersion,
      }),
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'conf-b',
          holderToken: fixture.holderToken,
          expectedLiveRevision: staleRevision,
          expectedAttemptNumber: 1,
        },
        intent: 'CONFIRM',
        payload: {},
        expectedScheduleVersion: scheduleVersion,
      }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled.length).toBe(1)
    expect(rejected.length).toBe(1)
    expect(rejected[0]?.reason).toBeInstanceOf(StaleLiveRevisionError)

    expect(
      await prisma.boutResult.count({
        where: { boutId: fixture.boutId, isCurrent: true },
      }),
    ).toBe(1)
  })
})
