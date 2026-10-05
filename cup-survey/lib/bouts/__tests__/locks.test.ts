import { describe, expect, it, vi } from 'vitest'
import { lockMatScheduleRuntimeRows } from '../locks'

describe('lockMatScheduleRuntimeRows cross-mat deadlock prevention', () => {
  it('locks mat indexes in sorted order', async () => {
    const locked: number[] = []
    const tx = {
      $executeRaw: vi.fn(async (_strings: unknown, matIndex: number) => {
        locked.push(matIndex)
      }),
      matScheduleRuntime: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    }

    await lockMatScheduleRuntimeRows(tx as never, [3, 1, 2, 2])

    expect(locked).toEqual([1, 2, 3])
  })
})
