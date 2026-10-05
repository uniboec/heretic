import { beforeEach, describe, expect, it } from 'vitest'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import { prisma } from '@/lib/prisma'
import { enqueueAwardCeremony } from '@/lib/awards/enqueue'
import { bulkCompleteCategory } from '@/lib/awards/mutations'
import { ensureAwardsPageSettings } from '@/lib/awards/settings'
import { syncAwardAnnouncerState } from '@/lib/announcer/hooks/awardHooks'
import {
  enableAnnouncerForTests,
  purgeAnnouncerIntegrationState,
} from './helpers'

const scopeId = TOURNAMENT_SCOPE_ID

async function resetAwardsTables() {
  await prisma.awardCeremonyPlacement.deleteMany()
  await prisma.awardCeremonyQueue.deleteMany()
  await prisma.awardCeremonyOperation.deleteMany()
  await prisma.awardsPageSetting.updateMany({
    where: { tournamentScopeId: scopeId },
    data: { queueRevision: 0, ceremonySequenceCounter: 0 },
  })
}

async function enqueueCategory(categoryKey: string) {
  await prisma.$transaction((tx) =>
    enqueueAwardCeremony(tx, {
      categoryKey,
      result: {
        status: 'complete',
        placements: [{ entryId: `${categoryKey}-1`, placement: 1, reason: 'FINAL_WINNER' }],
      },
      participants: [
        { entryId: `${categoryKey}-1`, displayName: 'A A', clubName: 'Club' },
      ],
    }),
  )
}

async function listAwardAutoEvents(queueIds: string[]) {
  return prisma.announcerEvent.findMany({
    where: {
      tournamentScopeId: scopeId,
      type: { in: ['AWARD_CALL', 'AWARD_PREPARE'] },
      sourceId: { in: queueIds },
    },
    orderBy: { createdAt: 'asc' },
  })
}

describe('award announcer queue shift', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await ensureAwardsPageSettings()
    await resetAwardsTables()
    await purgeAnnouncerIntegrationState(scopeId)
    await enableAnnouncerForTests(scopeId)
  })

  it('creates AWARD_CALL and AWARD_PREPARE for first two pending categories', async () => {
    await enqueueCategory('cat-a')
    await enqueueCategory('cat-b')
    await enqueueCategory('cat-c')

    await syncAwardAnnouncerState(scopeId)

    const queue = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: scopeId, status: 'PENDING' },
      orderBy: { queueOrder: 'asc' },
    })
    const events = await listAwardAutoEvents(queue.map((row) => row.id))
    expect(events).toHaveLength(2)
    expect(events[0]?.type).toBe('AWARD_CALL')
    expect(events[1]?.type).toBe('AWARD_PREPARE')

    const callPayload = events[0]?.payload as { queueId?: string }
    const preparePayload = events[1]?.payload as { queueId?: string }
    expect(callPayload.queueId).toBe(queue[0]?.id)
    expect(preparePayload.queueId).toBe(queue[1]?.id)
  })

  it('after first category completes, shifts to next AWARD_CALL and AWARD_PREPARE', async () => {
    await enqueueCategory('cat-a')
    await enqueueCategory('cat-b')
    await enqueueCategory('cat-c')

    const pending = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: scopeId, status: 'PENDING' },
      orderBy: { queueOrder: 'asc' },
    })
    const [first, second, third] = pending
    if (!first || !second || !third) throw new Error('expected three categories')
    const queueIds = pending.map((row) => row.id)

    await syncAwardAnnouncerState(scopeId)

    await bulkCompleteCategory({
      operationId: 'op-complete-first',
      queueId: first.id,
      expectedRevision: first.revision,
    })
    await syncAwardAnnouncerState(scopeId)

    const events = await listAwardAutoEvents(queueIds)
    expect(events).toHaveLength(4)

    const newCall = events[2]
    const newPrepare = events[3]
    expect(newCall?.type).toBe('AWARD_CALL')
    expect(newPrepare?.type).toBe('AWARD_PREPARE')

    const callPayload = newCall?.payload as { queueId?: string }
    const preparePayload = newPrepare?.payload as { queueId?: string }
    expect(callPayload.queueId).toBe(second.id)
    expect(preparePayload.queueId).toBe(third.id)

    const callState = await prisma.announcerPositionState.findUnique({
      where: {
        tournamentScopeId_scopeKey: {
          tournamentScopeId: scopeId,
          scopeKey: 'award:call',
        },
      },
    })
    const prepareState = await prisma.announcerPositionState.findUnique({
      where: {
        tournamentScopeId_scopeKey: {
          tournamentScopeId: scopeId,
          scopeKey: 'award:prepare',
        },
      },
    })
    expect(callState?.currentPositionId).toBe(second.id)
    expect(prepareState?.currentPositionId).toBe(third.id)
  })

  it('after first category completes with only two left, creates call only', async () => {
    await enqueueCategory('cat-a')
    await enqueueCategory('cat-b')

    const pending = await prisma.awardCeremonyQueue.findMany({
      where: { tournamentScopeId: scopeId, status: 'PENDING' },
      orderBy: { queueOrder: 'asc' },
    })
    const [first, second] = pending
    if (!first || !second) throw new Error('expected two categories')
    const queueIds = pending.map((row) => row.id)

    await syncAwardAnnouncerState(scopeId)

    await bulkCompleteCategory({
      operationId: 'op-complete-first-two',
      queueId: first.id,
      expectedRevision: first.revision,
    })
    await syncAwardAnnouncerState(scopeId)

    const events = await listAwardAutoEvents(queueIds)
    expect(events).toHaveLength(3)
    expect(events[2]?.type).toBe('AWARD_CALL')
    const callPayload = events[2]?.payload as { queueId?: string }
    expect(callPayload.queueId).toBe(second.id)

    const prepareState = await prisma.announcerPositionState.findUnique({
      where: {
        tournamentScopeId_scopeKey: {
          tournamentScopeId: scopeId,
          scopeKey: 'award:prepare',
        },
      },
    })
    expect(prepareState?.currentPositionId).toBeNull()
  })
})
