import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

vi.mock('../../core/eligibility', () => ({
  loadEligibleEntries: vi.fn().mockResolvedValue([
    { entryId: 'e1', effectiveCategoryKey: 'cat:a', sourceCategoryKey: 'cat:a' },
  ]),
}))

vi.mock('../../generation/rebuildDraw', () => ({
  rebuildDrawAfterCompositionChange: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../generation/publicationState', () => ({
  ensureLivePublicationPointers: vi.fn().mockResolvedValue(undefined),
  upsertPublicationPointer: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../generation/redraw', () => ({
  redrawCategoryDrawsInTransaction: vi.fn().mockResolvedValue([]),
}))

import { forceRebuildCategories } from '../forceRebuild'

describe('forceRebuildPreservesVisible', () => {
  it('resets bouts release state but does not change visible flag when preserveVisible is true', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const drawUpdate = vi.fn().mockResolvedValue({})
    const drawFindUnique = vi.fn().mockResolvedValue({
      id: 'draw-1',
      categoryKey: 'cat:a',
      redrawRevision: 0,
      participants: [{ id: 'p1', entryId: 'e1', seedPosition: 1, seedLocked: false }],
    })

    const tx = {
      bracketPageSetting: {
        findUnique: vi.fn().mockResolvedValue({ includePaid: true, includeUnpaid: false }),
      },
      bracketFormatRule: { findMany: vi.fn().mockResolvedValue([]) },
      bracketCategoryDraw: {
        findUnique: drawFindUnique,
        update: drawUpdate,
        delete: vi.fn(),
      },
      bracketPublicationState: { updateMany },
      bracketGeneration: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'gen-1', baseSeed: 'seed' }),
      },
      bracketDrawParticipant: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', entryId: 'e1', seedPosition: 1, seedLocked: false },
        ]),
        delete: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      bracketEntryPlacement: { findMany: vi.fn().mockResolvedValue([]) },
    }

    await forceRebuildCategories(tx as never, {
      generationId: 'gen-1',
      categoryKeys: ['cat:a'],
      preserveVisible: true,
    })

    expect(updateMany).toHaveBeenCalledWith({
      where: { categoryKey: 'cat:a' },
      data: {
        boutsReleased: false,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: null,
      },
    })
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty('visible')
  })
})
