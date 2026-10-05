import { describe, expect, it, vi } from 'vitest'
import { deleteCategoryDrawIfEmpty } from '../core/cleanupEmptyDraw'

describe('deleteCategoryDrawIfEmpty', () => {
  it('deletes publication state and draw when participant count is zero', async () => {
    const deleteDrawMock = vi.fn()
    const deletePublicationMock = vi.fn()
    const tx = {
      bracketCategoryDraw: {
        findUnique: vi.fn().mockResolvedValue({ id: 'draw-1', categoryKey: 'cat-a' }),
        delete: deleteDrawMock,
      },
      bracketPublicationState: {
        deleteMany: deletePublicationMock,
      },
    }

    const deleted = await deleteCategoryDrawIfEmpty(
      tx as unknown as Parameters<typeof deleteCategoryDrawIfEmpty>[0],
      'draw-1',
      0,
    )

    expect(deleted).toBe(true)
    expect(deletePublicationMock).toHaveBeenCalledWith({ where: { categoryKey: 'cat-a' } })
    expect(deleteDrawMock).toHaveBeenCalledWith({ where: { id: 'draw-1' } })
  })

  it('keeps draw when participants remain', async () => {
    const deleteDrawMock = vi.fn()
    const tx = {
      bracketCategoryDraw: {
        findUnique: vi.fn(),
        delete: deleteDrawMock,
      },
      bracketPublicationState: {
        deleteMany: vi.fn(),
      },
    }

    const deleted = await deleteCategoryDrawIfEmpty(
      tx as unknown as Parameters<typeof deleteCategoryDrawIfEmpty>[0],
      'draw-1',
      2,
    )

    expect(deleted).toBe(false)
    expect(deleteDrawMock).not.toHaveBeenCalled()
  })
})
