import { beforeEach, describe, expect, it, vi } from 'vitest'
import { syncAwardCeremonyOnCorrection } from '../syncOnCorrection'

const tx = {
  awardCeremonyQueue: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  awardCeremonyPlacement: {
    deleteMany: vi.fn(),
  },
}

vi.mock('../suspend', () => ({
  suspendAwardCeremonyOnRegression: vi.fn(async () => true),
}))

vi.mock('../scopeLock', () => ({
  bumpCategoryRevision: vi.fn(async () => 2),
}))

describe('syncAwardCeremonyOnCorrection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets needsReview when ceremony already started on regression', async () => {
    tx.awardCeremonyQueue.findUnique.mockResolvedValue({
      id: 'q1',
      status: 'IN_PROGRESS',
      ceremonySequence: 3,
      actualStartAt: new Date(),
      placements: [{ status: 'PENDING' }],
    })

    await syncAwardCeremonyOnCorrection(tx as never, {
      categoryKey: 'cat-a',
      newResult: null,
      participants: [],
      bracketStatus: 'in_progress',
    })

    expect(tx.awardCeremonyQueue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ needsReview: true }),
      }),
    )
  })

  it('auto-syncs placements when complete and all pending', async () => {
    tx.awardCeremonyQueue.findUnique.mockResolvedValue({
      id: 'q1',
      status: 'PENDING',
      ceremonySequence: null,
      actualStartAt: null,
      placements: [{ status: 'PENDING' }],
    })
    tx.awardCeremonyQueue.update.mockResolvedValue({})

    await syncAwardCeremonyOnCorrection(tx as never, {
      categoryKey: 'cat-a',
      newResult: {
        status: 'complete',
        placements: [
          { entryId: 'e1', placement: 1, reason: 'FINAL_WINNER' },
          { entryId: 'e2', placement: 2, reason: 'FINAL_LOSER' },
        ],
      },
      participants: [
        { entryId: 'e1', displayName: 'A A', clubName: 'C1' },
        { entryId: 'e2', displayName: 'B B', clubName: 'C2' },
      ],
      bracketStatus: 'complete',
    })

    expect(tx.awardCeremonyPlacement.deleteMany).toHaveBeenCalled()
    expect(tx.awardCeremonyQueue.update).toHaveBeenCalled()
  })
})
