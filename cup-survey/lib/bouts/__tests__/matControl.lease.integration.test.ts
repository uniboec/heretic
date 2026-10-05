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
import { LeaseNotHeldError, StaleLiveRevisionError } from '../mat-control/errors'
import {
  acquireMatSession,
  executeMatControlCommand,
  getMatControlSnapshot,
  takeoverMatSession,
} from '../matControlService'

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

describe('mat control lease integration', () => {
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
    const seeded = await seedPaidPairInCategory('w_66', 'lease')
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
    const snapshot = await getMatControlSnapshot(1)
    const bout =
      snapshot.activeBout?.bout ??
      snapshot.queue.nextAvailable?.bout ??
      snapshot.queue.upcoming[0]?.bout
    if (!bout) throw new Error('No bout on mat 1')

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
    if (!redEntryId || !blueEntryId) throw new Error('Bout participants missing')

    return {
      boutId: bout.id,
      redEntryId,
      blueEntryId,
    }
  }

  it('rejects commands from foreign holder token', async () => {
    const fixture = await seedFixture()

    await expect(
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope: {
          operationId: 'op-lease',
          holderToken: 'foreign-token',
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.redEntryId, corner: 'red' },
      }),
    ).rejects.toBeInstanceOf(LeaseNotHeldError)
  })

  it('rejects stale live revision', async () => {
    const fixture = await seedFixture()

    await executeMatControlCommand({
      boutId: fixture.boutId,
      envelope: {
        operationId: 'op-first',
        holderToken: 'holder-a',
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
          operationId: 'op-stale',
          holderToken: 'holder-a',
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: fixture.blueEntryId, corner: 'blue' },
      }),
    ).rejects.toBeInstanceOf(StaleLiveRevisionError)
  })

  it('allows takeover and blocks old holder afterwards', async () => {
    await seedFixture()
    await takeoverMatSession(1, 'holder-b')

    const snapshot = await getMatControlSnapshot(1)
    const boutId =
      snapshot.queue.nextAvailable?.bout.id ??
      snapshot.queue.upcoming[0]?.bout.id ??
      snapshot.activeBout?.bout.id
    if (!boutId) throw new Error('No bout for takeover test')

    await expect(
      executeMatControlCommand({
        boutId,
        envelope: {
          operationId: 'op-old-holder',
          holderToken: 'holder-a',
          expectedLiveRevision: 0,
          expectedAttemptNumber: 1,
        },
        intent: 'FIRST_CALL',
        payload: { entryId: 'x', corner: 'red' },
      }),
    ).rejects.toBeInstanceOf(LeaseNotHeldError)
  })

  it('deduplicates parallel commands with the same operationId', async () => {
    const fixture = await seedFixture()
    const envelope = {
      operationId: 'op-parallel',
      holderToken: 'holder-a',
      expectedLiveRevision: 0,
      expectedAttemptNumber: 1,
    }
    const payload = { entryId: fixture.redEntryId, corner: 'red' as const }

    const [first, second] = await Promise.all([
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope,
        intent: 'FIRST_CALL',
        payload,
      }),
      executeMatControlCommand({
        boutId: fixture.boutId,
        envelope,
        intent: 'FIRST_CALL',
        payload,
      }),
    ])

    expect(second).toEqual(first)
    expect(await prisma.boutEvent.count({ where: { boutId: fixture.boutId } })).toBe(1)
  })
})
