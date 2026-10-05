import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { assertIntegrationTestDatabase } from '@/lib/db/integrationDatabaseUrl'
import { reserveAwardOperation, withAwardOperation } from '../../idempotency'
import { ensureAwardsPageSettings } from '../../settings'

describe('award idempotency integration', () => {
  beforeEach(async () => {
    assertIntegrationTestDatabase()
    await ensureAwardsPageSettings()
    await prisma.awardCeremonyOperation.deleteMany()
  })

  it('rejects reused operationId with different request hash', async () => {
    await prisma.$transaction(async (tx) => {
      await reserveAwardOperation({
        tx,
        operationId: 'op-hash-a',
        requestHash: 'hash-a',
      })
    })

    await expect(
      prisma.$transaction((tx) =>
        reserveAwardOperation({
          tx,
          operationId: 'op-hash-a',
          requestHash: 'hash-b',
        }),
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('replays stored response through withAwardOperation', async () => {
    const requestPayload = {
      operationId: 'op-with-award',
      expectedRevision: 7,
      status: 'AWARDED',
    }

    const first = await prisma.$transaction((tx) =>
      withAwardOperation({
        tx,
        operationId: 'op-with-award',
        requestPayload,
        run: async () => ({ queueRevision: 4, changed: true }),
      }),
    )

    const replay = await prisma.$transaction((tx) =>
      withAwardOperation({
        tx,
        operationId: 'op-with-award',
        requestPayload,
        run: async () => ({ queueRevision: 99, changed: false }),
      }),
    )

    expect(replay).toEqual(first)

    const stored = await prisma.awardCeremonyOperation.findUnique({
      where: {
        tournamentScopeId_operationId: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          operationId: 'op-with-award',
        },
      },
    })

    expect(stored?.responsePayload).toEqual({ queueRevision: 4, changed: true })
  })

  it('returns OPERATION_IN_PROGRESS when operation is reserved but unfinished', async () => {
    await prisma.awardCeremonyOperation.create({
      data: {
        tournamentScopeId: TOURNAMENT_SCOPE_ID,
        operationId: 'op-in-flight',
        requestHash: 'hash-in-flight',
      },
    })

    await expect(
      prisma.$transaction((tx) =>
        reserveAwardOperation({
          tx,
          operationId: 'op-in-flight',
          requestHash: 'hash-in-flight',
        }),
      ),
    ).rejects.toMatchObject({ code: 'OPERATION_IN_PROGRESS' })
  })
})
