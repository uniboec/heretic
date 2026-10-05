import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'

const { acquireBracketWriteLocks } = vi.hoisted(() => ({
  acquireBracketWriteLocks: vi.fn(),
}))

vi.mock('../../brackets/live/locks', () => ({
  acquireBracketWriteLocks,
}))

vi.mock('../../brackets/generation/publicationState', () => ({
  ensureLivePublicationPointers: vi.fn().mockResolvedValue(undefined),
}))

import * as publishedDraws from '../../brackets/generation/publishedDraws'
import { prisma } from '../../prisma'
import { setCategoriesBoutsReleased } from '../release'

function scheduleSnapshotMocks() {
  return {
    boutsPageSetting: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'default',
        publicEnabled: true,
        matCount: 3,
        autoMatAssignMode: 'BY_BOUT',
        autoMatByCategoryEnabled: false,
        boutsStartTime: '10:00',
        matStartTimeOverrides: null,
        boutBreakMinutes: 3,
        ageDivisionDurationOverrides: null,
      }),
    },
    boutScheduleExecution: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    matScheduleRuntime: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('setCategoriesBoutsReleased tx-bound draw loads', () => {
  beforeEach(() => {
    acquireBracketWriteLocks.mockResolvedValue({
      boutsSettings: {
        id: 'default',
        matCount: 3,
        autoMatAssignMode: 'BY_BOUT',
        autoMatByCategoryEnabled: false,
      },
      registrationState: { id: 'default', revision: BigInt(0) },
      generation: { id: 'pub-gen-1', version: 1, status: 'PUBLISHED' },
      draws: [],
      publicationStates: [],
    })
    vi.spyOn(publishedDraws, 'getActivePublishedGeneration').mockResolvedValue({
      id: 'pub-gen-1',
    } as never)
    vi.spyOn(publishedDraws, 'getCurrentPublishedDraws').mockResolvedValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    acquireBracketWriteLocks.mockReset()
  })

  it('loads released and current pairs through the same transaction client', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
      ...scheduleSnapshotMocks(),
      bracketGeneration: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      bracketCategoryDraw: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bracketPublicationState: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      bracketEntryPlacement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient

    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => fn(mockTx))

    await expect(
      setCategoriesBoutsReleased({
        scope: 'ready',
        released: true,
        expectedPublishedGenerationId: 'pub-gen-1',
      }),
    ).resolves.toMatchObject({ ok: true, noop: true })

    expect(acquireBracketWriteLocks).toHaveBeenCalledWith(mockTx, {
      scope: 'minimal',
      categoryKeys: undefined,
    })
    expect(publishedDraws.getCurrentPublishedDraws).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockTx,
        activeGeneration: { id: 'pub-gen-1' },
      }),
    )
  })

  it('throws INVALID_MAT_COUNT when matCount < 1 under lock', async () => {
    acquireBracketWriteLocks.mockResolvedValue({
      boutsSettings: {
        id: 'default',
        matCount: 0,
        autoMatAssignMode: 'BY_BOUT',
        autoMatByCategoryEnabled: false,
      },
      registrationState: { id: 'default', revision: BigInt(0) },
      generation: { id: 'pub-gen-1', version: 1, status: 'PUBLISHED' },
      draws: [],
      publicationStates: [],
    })

    const mockTx = {
      $queryRaw: vi.fn(),
      ...scheduleSnapshotMocks(),
      bracketGeneration: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      bracketCategoryDraw: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      bracketPublicationState: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      bracketEntryPlacement: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as unknown as Prisma.TransactionClient

    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => fn(mockTx))

    await expect(
      setCategoriesBoutsReleased({
        scope: 'ready',
        released: true,
        expectedPublishedGenerationId: 'pub-gen-1',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_MAT_COUNT' })
  })
})
