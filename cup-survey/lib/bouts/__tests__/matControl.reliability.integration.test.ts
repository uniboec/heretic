import { randomUUID } from 'node:crypto'
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
import { TOURNAMENT_SCOPE_ID } from '../../config/tournament'
import { buildCommandPayloadHash } from '../matControlReliability/commandPayload'
import {
  BoutAlreadyCommittedError,
  acquireBoutSession,
  handoffBoutSession,
} from '../matControlReliability/ownership'
import { validateReliabilityFencing } from '../matControlReliability/applyReliabilityCommand'
import { BoutAlreadyCommittedError as BoutAlreadyCommittedApiError } from '../mat-control/errors'
import { acquireMatSession, executeMatControlCommand } from '../matControlService'

async function purgeReliabilityTables() {
  await prisma.boutBracketUnlockOutbox.deleteMany()
  await prisma.boutOwnershipTakeoverLog.deleteMany()
  await prisma.boutSessionCommitAck.deleteMany()
  await prisma.boutSessionAcquireRequest.deleteMany()
  await prisma.boutSessionOwnership.deleteMany()
  await prisma.boutControlCommand.deleteMany()
  await prisma.boutEvent.deleteMany()
  await prisma.boutResultRevision.deleteMany()
  await prisma.boutResult.deleteMany()
  await prisma.matControlSession.deleteMany()
  await prisma.boutScheduleExecution.deleteMany()
}

describe('mat control reliability integration', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  beforeEach(async () => {
    if (!dbAvailable) return
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    await purgeBracketIntegrationState()
    await purgeReliabilityTables()
    await ensureBracketDefaults()
    await seedBoutsPageSetting()
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (!dbAvailable) return
    await purgeReliabilityTables()
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
  })

  async function seedBoutId() {
    const seeded = await seedPaidPairInCategory('w_66', 'reliability')
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

    await acquireMatSession(1, 'holder-a')
    const execution = await prisma.boutScheduleExecution.findFirst()
    if (!execution) throw new Error('Execution missing')
    return execution.boutId
  }

  it('acquire is idempotent for the same acquireRequestId', async () => {
    const boutId = await seedBoutId()
    const acquireRequestId = randomUUID()
    const clientSessionId = randomUUID()

    const first = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, { boutId, acquireRequestId, clientSessionId }),
    )
    const second = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, { boutId, acquireRequestId, clientSessionId }),
    )

    expect(second).toEqual(first)
    expect(await prisma.boutSessionOwnership.count({ where: { boutId } })).toBe(1)
  })

  it('rejects acquire when bout result already committed', async () => {
    const boutId = await seedBoutId()
    await prisma.boutResult.create({
      data: {
        boutId,
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        winnerEntryId: 'e1',
        loserEntryId: 'e2',
        victoryMethod: 'POINTS',
        decisionReason: 'test',
        decidedInPeriod: 'main',
        resultConfirmedAt: new Date(),
      },
    })

    await expect(
      prisma.$transaction((tx) =>
        acquireBoutSession(tx, { boutId, acquireRequestId: randomUUID() }),
      ),
    ).rejects.toBeInstanceOf(BoutAlreadyCommittedError)
  })

  it('fences superseded owner after handoff', async () => {
    const boutId = await seedBoutId()
    const acquireRequestId = randomUUID()
    const oldClient = randomUUID()

    const session = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, { boutId, acquireRequestId, clientSessionId: oldClient }),
    )

    const newClient = randomUUID()
    await prisma.$transaction((tx) =>
      handoffBoutSession(tx, {
        boutId,
        boutSessionId: session.boutSessionId,
        newClientSessionId: newClient,
        adminId: 'admin',
        reason: 'test_takeover',
        suffixDisposition: 'UNKNOWN_FORCE_TAKEOVER',
      }),
    )

    await expect(
      prisma.$transaction((tx) =>
        validateReliabilityFencing(tx, {
          boutId,
          commandId: randomUUID(),
          boutSessionId: session.boutSessionId,
          clientSessionId: oldClient,
          ownershipEpoch: session.ownershipEpoch,
          sequenceNo: 1,
          intent: 'CLOCK_START',
          payload: { boutElapsedMs: 0 },
          payloadHash: buildCommandPayloadHash({
            intent: 'CLOCK_START',
            sequenceNo: 1,
            payload: { boutElapsedMs: 0 },
            includeBoutElapsedMs: true,
          }),
          includeBoutElapsedMs: true,
        }),
      ),
    ).rejects.toThrow()
  })

  it('rejects new commands on committed session', async () => {
    const boutId = await seedBoutId()
    const session = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, { boutId, acquireRequestId: randomUUID() }),
    )

    await prisma.boutSessionOwnership.update({
      where: { boutSessionId: session.boutSessionId },
      data: { sessionStatus: 'COMMITTED', releasedAt: new Date() },
    })

    await expect(
      prisma.$transaction((tx) =>
        validateReliabilityFencing(tx, {
          boutId,
          commandId: randomUUID(),
          boutSessionId: session.boutSessionId,
          clientSessionId: session.clientSessionId,
          ownershipEpoch: session.ownershipEpoch,
          sequenceNo: 1,
          intent: 'CLOCK_START',
          payload: { boutElapsedMs: 0 },
          payloadHash: buildCommandPayloadHash({
            intent: 'CLOCK_START',
            sequenceNo: 1,
            payload: { boutElapsedMs: 0 },
            includeBoutElapsedMs: true,
          }),
          includeBoutElapsedMs: true,
        }),
      ),
    ).rejects.toBeInstanceOf(BoutAlreadyCommittedApiError)
  })

  it('writes STAGED events with reliability sequence when command sent', async () => {
    const boutId = await seedBoutId()
    const session = await prisma.$transaction((tx) =>
      acquireBoutSession(tx, { boutId, acquireRequestId: randomUUID() }),
    )

    const redEntry = await prisma.bracketEntry.findFirst({ select: { id: true } })
    if (!redEntry) throw new Error('entry missing')

    const payload = { entryId: redEntry.id, corner: 'red' as const }
    const payloadHash = buildCommandPayloadHash({
      intent: 'FIRST_CALL',
      sequenceNo: 1,
      payload,
      includeBoutElapsedMs: true,
    })

    await executeMatControlCommand({
      boutId,
      envelope: {
        operationId: randomUUID(),
        holderToken: 'holder-a',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
        reliability: {
          boutSessionId: session.boutSessionId,
          clientSessionId: session.clientSessionId,
          ownershipEpoch: session.ownershipEpoch,
          sequenceNo: 1,
          payloadHash,
        },
      },
      intent: 'FIRST_CALL',
      payload,
    })

    const staged = await prisma.boutEvent.findMany({
      where: { boutId, eventStatus: 'STAGED', boutSessionId: session.boutSessionId },
    })
    expect(staged).toHaveLength(1)
    expect(staged[0]?.sequence).toBe(1)
    expect(staged[0]?.eventHash).toHaveLength(64)
  })
})
