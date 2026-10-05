import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../prisma'
import { publishBracketDraft } from '../../brackets/generation/publish'
import { setCategoriesBoutsReleased } from '../release'
import { updateBracketDrawMatIndex, updateMatManualOrder } from '../mutations'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  ensureBracketDefaults,
  purgeBracketIntegrationState,
  seedBoutsPageSetting,
  seedCategoryWithAthletes,
  syncRedrawAll,
} from '../../brackets/__tests__/integration/helpers'
import { dbAvailable, useIntegrationDb } from '../../brackets/__tests__/integration/setup'
import {
  acquireMatSession,
  executeMatControlCommand,
} from '../matControlService'
import { buildScheduledMats, loadFullScheduleSnapshot } from '../scheduleService'
import type { ScheduledBout } from '../scheduleTypes'

async function purgeMatControlTables() {
  await prisma.scheduleMutationLog.deleteMany()
  await prisma.boutControlCommand.deleteMany()
  await prisma.boutEvent.deleteMany()
  await prisma.boutResult.deleteMany()
  await prisma.boutScheduleExecution.deleteMany()
  await prisma.matControlSession.deleteMany()
}

describe('schedule freeze guards integration', () => {
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

  async function seedFourAthleteMatQueue() {
    const seeded = await seedCategoryWithAthletes({ participantCount: 4 })
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

    const holderToken = 'schedule-freeze-holder'
    await acquireMatSession(1, holderToken)

    const scheduleSnapshot = await loadFullScheduleSnapshot(prisma, { adminPreview: true })
    const scheduled = buildScheduledMats({
      grouped: scheduleSnapshot.grouped,
      snapshot: scheduleSnapshot,
      now: new Date(),
    })
    const mat1 = scheduled.mats.find((mat) => mat.matIndex === 1)
    if (!mat1) {
      throw new Error('Mat 1 missing from schedule')
    }

    const athleteBouts = mat1.bouts.filter(
      (bout): bout is ScheduledBout =>
        bout.sideA.kind === 'athlete' && bout.sideB.kind === 'athlete',
    )
    const firstBout = athleteBouts.find((bout) => bout.isNextStartable)
    const secondBout = athleteBouts.find((bout) => !bout.isNextStartable)

    if (!firstBout || !secondBout) {
      throw new Error('Expected next-startable and non-next-startable athlete bouts on mat 1')
    }

    return {
      holderToken,
      firstBout,
      secondBout,
      allMatBoutIds: mat1.bouts.map((bout) => bout.id),
    }
  }

  async function readScheduleVersion() {
    const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
    return settings.scheduleVersion
  }

  async function prepareNoShowForBout(input: {
    bout: ScheduledBout
    holderToken: string
    expectedScheduleVersion: number
    operationPrefix: string
  }): Promise<number> {
    if (input.bout.sideA.kind !== 'athlete' || input.bout.sideB.kind !== 'athlete') {
      throw new Error('NO_SHOW preparation requires athlete sides')
    }

    const liveRevision = { value: 0 }
    const runIntent = async (
      operationId: string,
      intent: 'FIRST_CALL' | 'SECONDARY_CALL',
      payload: Record<string, unknown>,
    ) => {
      const response = await executeMatControlCommand({
        boutId: input.bout.id,
        envelope: {
          operationId,
          holderToken: input.holderToken,
          expectedLiveRevision: liveRevision.value,
          expectedAttemptNumber: 1,
        },
        intent,
        payload,
        expectedScheduleVersion: input.expectedScheduleVersion,
      }) as { liveRevision?: number }
      if (typeof response.liveRevision === 'number') {
        liveRevision.value = response.liveRevision
      }
    }

    await runIntent(`${input.operationPrefix}-red`, 'FIRST_CALL', {
      entryId: input.bout.sideA.entryId,
      corner: 'red',
    })
    await runIntent(`${input.operationPrefix}-blue`, 'FIRST_CALL', {
      entryId: input.bout.sideB.entryId,
      corner: 'blue',
    })
    await runIntent(`${input.operationPrefix}-secondary`, 'SECONDARY_CALL', {
      entryId: input.bout.sideA.entryId,
      corner: 'red',
    })

    const secondaryCall = await prisma.boutEvent.findFirst({
      where: { boutId: input.bout.id, eventType: 'SECONDARY_CALL' },
      orderBy: { sequence: 'desc' },
    })
    if (secondaryCall) {
      await prisma.boutEvent.update({
        where: { id: secondaryCall.id },
        data: { createdAt: new Date(Date.now() - 121_000) },
      })
    }

    return liveRevision.value
  }

  it('allows out-of-order NO_SHOW from mat control without manual reorder', async () => {
    if (!dbAvailable) return

    const { holderToken, firstBout, secondBout } = await seedFourAthleteMatQueue()
    const loserEntryId =
      secondBout.sideA.kind === 'athlete'
        ? secondBout.sideA.entryId
        : secondBout.sideB.entryId

    const liveRevision = await prepareNoShowForBout({
      bout: secondBout,
      holderToken,
      expectedScheduleVersion: await readScheduleVersion(),
      operationPrefix: 'flex-order-no-show',
    })

    await executeMatControlCommand({
      boutId: secondBout.id,
      envelope: {
        operationId: '11111111-1111-4111-8111-111111111111',
        holderToken,
        expectedLiveRevision: liveRevision,
        expectedAttemptNumber: 1,
      },
      intent: 'NO_SHOW',
      payload: {
        corner: 'red',
        entryId: loserEntryId,
      },
      expectedScheduleVersion: await readScheduleVersion(),
    })

    const frozen = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: secondBout.id },
    })
    expect(frozen?.frozenScheduleFormatted).toMatch(/^\d+(-\d+)?$/)

    const firstExecution = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: firstBout.id },
    })
    expect(firstExecution?.frozenScheduleFormatted ?? null).toBeNull()
  })

  it('allows NO_SHOW after reordering target bout to the front', async () => {
    if (!dbAvailable) return

    const { holderToken, secondBout, allMatBoutIds } = await seedFourAthleteMatQueue()
    const versionBeforeReorder = await readScheduleVersion()

    const reorder = await updateMatManualOrder({
      matIndex: 1,
      orderedBoutIds: [secondBout.id, ...allMatBoutIds.filter((id) => id !== secondBout.id)],
      expectedScheduleVersion: versionBeforeReorder,
    })
    expect(reorder.scheduleVersion).toBeGreaterThan(versionBeforeReorder)

    const loserEntryId =
      secondBout.sideA.kind === 'athlete'
        ? secondBout.sideA.entryId
        : secondBout.sideB.entryId

    const liveRevision = await prepareNoShowForBout({
      bout: secondBout,
      holderToken,
      expectedScheduleVersion: reorder.scheduleVersion,
      operationPrefix: 'reorder-no-show',
    })

    await executeMatControlCommand({
      boutId: secondBout.id,
      envelope: {
        operationId: '22222222-2222-4222-8222-222222222222',
        holderToken,
        expectedLiveRevision: liveRevision,
        expectedAttemptNumber: 1,
      },
      intent: 'NO_SHOW',
      payload: {
        corner: 'red',
        entryId: loserEntryId,
      },
      expectedScheduleVersion: reorder.scheduleVersion,
    })

    const frozen = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: secondBout.id },
    })
    expect(frozen?.frozenScheduleFormatted).toMatch(/^\d+(-\d+)?$/)
  })

  it('freezes schedule number on scheduled STOPPAGE_INJURY without START', async () => {
    if (!dbAvailable) return

    const { holderToken, firstBout } = await seedFourAthleteMatQueue()

    await executeMatControlCommand({
      boutId: firstBout.id,
      envelope: {
        operationId: '44444444-4444-4444-8444-444444444444',
        holderToken,
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'STOPPAGE_INJURY',
      payload: {
        injuredCorner: 'red',
      },
      expectedScheduleVersion: await readScheduleVersion(),
    })

    const frozen = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: firstBout.id },
    })
    expect(frozen?.frozenScheduleFormatted).toMatch(/^\d+(-\d+)?$/)
    expect(frozen?.actualStartAt).toBeNull()
  })

  it('freezes schedule number on scheduled PENALTY_DISQUALIFY', async () => {
    if (!dbAvailable) return

    const { holderToken, firstBout } = await seedFourAthleteMatQueue()
    const loserEntryId =
      firstBout.sideA.kind === 'athlete'
        ? firstBout.sideA.entryId
        : firstBout.sideB.entryId

    await executeMatControlCommand({
      boutId: firstBout.id,
      envelope: {
        operationId: '33333333-3333-4333-8333-333333333333',
        holderToken,
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'PENALTY_DISQUALIFY',
      payload: {
        corner: 'red',
        entryId: loserEntryId,
        ladder: 'GENERAL',
      },
      expectedScheduleVersion: await readScheduleVersion(),
    })

    const frozen = await prisma.boutScheduleExecution.findUnique({
      where: { boutId: firstBout.id },
    })
    expect(frozen?.frozenScheduleFormatted).toMatch(/^\d+(-\d+)?$/)
  })
})
