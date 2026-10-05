import { describe, expect, it, vi } from 'vitest'
import * as boutDuration from '../boutDuration'
import {
  assignByBout,
  assignByCategory,
  assignAutoCategoryByBout,
  assignAutoCategoryByCategory,
  getEffectiveAutoMatAssignMode,
  pickLeastLoadedMat,
} from '../autoMatAssign'
import { boutLoadWeight, createMatLoads, sumBoutLoads } from '../matLoad'
import type { AutoMatAssignMode } from '../autoMatMode'

describe('autoMatAssign', () => {
  describe('getEffectiveAutoMatAssignMode', () => {
    it('returns BY_BOUT when marker is off regardless of stored mode', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: false,
          autoMatAssignMode: 'BY_CATEGORY',
        }),
      ).toBe('BY_BOUT')
    })

    it('returns stored mode when marker is on', () => {
      expect(
        getEffectiveAutoMatAssignMode({
          autoMatByCategoryEnabled: true,
          autoMatAssignMode: 'BY_CATEGORY',
        }),
      ).toBe('BY_CATEGORY')
    })
  })

  describe('pickLeastLoadedMat', () => {
    it('prefers lower mat index on tie', () => {
      expect(pickLeastLoadedMat([3, 3, 3])).toBe(1)
    })

    it('picks least loaded mat', () => {
      expect(pickLeastLoadedMat([6, 3, 3])).toBe(2)
    })
  })

  describe('assignAutoCategoryByCategory', () => {
    it('assigns all bouts to one mat and increments counts by bout count', () => {
      const counts = [6, 3, 3]
      const bouts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      const { assignments, mat } = assignAutoCategoryByCategory(bouts, counts)

      expect(mat).toBe(2)
      expect(assignments).toEqual({ a: 2, b: 2, c: 2 })
      expect(counts).toEqual([6, 6, 3])
    })

    it('tie-break: equal counts pick mat 1 and add full batch load', () => {
      const counts = [3, 3, 3]
      const bouts = [{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'w' }, { id: 'v' }]
      const { assignments, mat } = assignAutoCategoryByCategory(bouts, counts)

      expect(mat).toBe(1)
      expect(Object.values(assignments).every((value) => value === 1)).toBe(true)
      expect(counts).toEqual([8, 3, 3])
    })
  })

  describe('assignAutoCategoryByBout', () => {
    it('balances each bout independently', () => {
      const counts = [6, 3, 3]
      const bouts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
      const assignments = assignAutoCategoryByBout(bouts, counts)

      expect(assignments).toEqual({ a: 2, b: 3, c: 2 })
      expect(counts).toEqual([6, 5, 4])
    })
  })

  function assignSortedCategoryBatch(
    categories: Array<{ key: string; boutCount: number }>,
    mode: AutoMatAssignMode,
    settings: { boutBreakMinutes: number; ageDivisionDurationOverrides: Record<string, number> },
    matCount: number,
  ) {
    const loads = createMatLoads(matCount)
    const categoryMats: Record<string, number> = {}
    const prepared = categories.map((category) => ({
      key: category.key,
      bouts: Array.from({ length: category.boutCount }, (_, index) => ({
        id: `${category.key}-${index}`,
        categoryKey: category.key,
      })),
    }))
    prepared.sort((a, b) => {
      const aSort =
        mode === 'BY_CATEGORY_TIME' ? sumBoutLoads(a.bouts, settings) : a.bouts.length
      const bSort =
        mode === 'BY_CATEGORY_TIME' ? sumBoutLoads(b.bouts, settings) : b.bouts.length
      return bSort - aSort || a.key.localeCompare(b.key, 'ru')
    })
    const weightFn = (bout: { id: string; categoryKey: string }) =>
      boutLoadWeight(bout, mode, settings)
    for (const category of prepared) {
      const { mat } = assignByCategory(category.bouts, loads, weightFn)
      categoryMats[category.key] = mat
    }
    return { loads, categoryMats }
  }

  function resultingTimeLoads(
    categories: Array<{ key: string; boutCount: number }>,
    categoryMats: Record<string, number>,
    settings: { boutBreakMinutes: number; ageDivisionDurationOverrides: Record<string, number> },
    matCount: number,
  ) {
    const timeLoads = createMatLoads(matCount)
    for (const category of categories) {
      const mat = categoryMats[category.key]
      const bouts = Array.from({ length: category.boutCount }, (_, index) => ({
        id: `${category.key}-${index}`,
        categoryKey: category.key,
      }))
      timeLoads[mat - 1] += sumBoutLoads(bouts, settings)
    }
    return timeLoads
  }

  describe('BY_CATEGORY_TIME makespan', () => {
    it('improves makespan vs BY_CATEGORY on 4-category fixture', () => {
      const settings = { boutBreakMinutes: 3, ageDivisionDurationOverrides: {} }
      const durationByKey: Record<string, number> = {
        C1: 2,
        C2: 2,
        C3: 2,
        C4: 5,
      }
      vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockImplementation(
        (input) => durationByKey[input.categoryKey] ?? 5,
      )

      const categories = [
        { key: 'C1', boutCount: 5 },
        { key: 'C2', boutCount: 8 },
        { key: 'C3', boutCount: 15 },
        { key: 'C4', boutCount: 20 },
      ]

      const countResult = assignSortedCategoryBatch(categories, 'BY_CATEGORY', settings, 2)
      const timeResult = assignSortedCategoryBatch(categories, 'BY_CATEGORY_TIME', settings, 2)

      expect(countResult.loads).toEqual([25, 23])
      expect(timeResult.loads).toEqual([160, 140])

      const countTimeLoads = resultingTimeLoads(
        categories,
        countResult.categoryMats,
        settings,
        2,
      )
      expect(countTimeLoads).toEqual([185, 115])
      expect(Math.max(...countTimeLoads)).toBe(185)
      expect(Math.max(...timeResult.loads)).toBe(160)
      expect(160).toBeLessThan(185)

      vi.restoreAllMocks()
    })
  })

  describe('category sort order divergence', () => {
    it('BY_CATEGORY picks A first, BY_CATEGORY_TIME picks B first', () => {
      const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
      vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockImplementation((input) => {
        if (input.categoryKey === 'A') return 5
        if (input.categoryKey === 'B') return 8
        return 5
      })

      const categories = [
        { key: 'A', boutCount: 10 },
        { key: 'B', boutCount: 8 },
      ]

      const countLoads = createMatLoads(2)
      const timeLoads = createMatLoads(2)
      const weightCount = (bout: { categoryKey: string }) =>
        boutLoadWeight(bout, 'BY_CATEGORY', settings)
      const weightTime = (bout: { categoryKey: string }) =>
        boutLoadWeight(bout, 'BY_CATEGORY_TIME', settings)

      const aBouts = Array.from({ length: 10 }, (_, index) => ({
        id: `A-${index}`,
        categoryKey: 'A',
      }))
      const bBouts = Array.from({ length: 8 }, (_, index) => ({
        id: `B-${index}`,
        categoryKey: 'B',
      }))

      assignByCategory(aBouts, countLoads, weightCount)
      assignByCategory(bBouts, timeLoads, weightTime)

      expect(countLoads[0]).toBe(10)
      expect(countLoads[1]).toBe(0)
      expect(timeLoads[0]).toBe(64)
      expect(timeLoads[1]).toBe(0)

      vi.restoreAllMocks()
    })
  })

  describe('assignByBout with time weights', () => {
    it('uses minute weights without changing bout processing order', () => {
      const settings = { boutBreakMinutes: 0, ageDivisionDurationOverrides: {} }
      vi.spyOn(boutDuration, 'resolveBoutDurationMinutes').mockImplementation((input) => {
        if (input.categoryKey === 'heavy') return 10
        return 1
      })

      const loads = createMatLoads(2)
      const bouts = [
        { id: 'a', categoryKey: 'light' },
        { id: 'b', categoryKey: 'heavy' },
        { id: 'c', categoryKey: 'light' },
      ]
      const weightFn = (bout: { categoryKey: string }) =>
        boutLoadWeight(bout, 'BY_BOUT_TIME', settings)
      const assignments = assignByBout(bouts, loads, weightFn)

      expect(assignments.a).toBe(1)
      expect(assignments.b).toBe(2)
      expect(assignments.c).toBe(1)
      expect(loads).toEqual([2, 10])

      vi.restoreAllMocks()
    })
  })
})
