import { describe, expect, it } from 'vitest'
import {
  buildMatCompletedBoutIds,
  findMatInProgressBoutId,
  isMatBoutCompleted,
} from '../matBoutCompletion'

describe('matBoutCompletion', () => {
  it('treats confirmed phase as completed even without schedule timestamps', () => {
    expect(
      isMatBoutCompleted({
        boutId: 'bout-1',
        boutPhase: 'confirmed',
        actualStartAt: null,
        actualEndAt: new Date(),
      }),
    ).toBe(true)
  })

  it('requires both timestamps when phase is not confirmed', () => {
    expect(
      isMatBoutCompleted({
        boutId: 'bout-1',
        boutPhase: 'live',
        actualStartAt: new Date(),
        actualEndAt: null,
      }),
    ).toBe(false)

    expect(
      isMatBoutCompleted({
        boutId: 'bout-1',
        boutPhase: 'live',
        actualStartAt: null,
        actualEndAt: new Date(),
      }),
    ).toBe(false)
  })

  it('findMatInProgressBoutId returns live bout on the mat', () => {
    expect(
      findMatInProgressBoutId(
        [
          {
            boutId: 'bout-1',
            boutPhase: 'live',
            actualStartAt: new Date(),
            actualEndAt: null,
          },
          {
            boutId: 'bout-2',
            boutPhase: 'scheduled',
            actualStartAt: null,
            actualEndAt: null,
          },
        ],
        new Set(['bout-1', 'bout-2']),
      ),
    ).toBe('bout-1')
  })

  it('buildMatCompletedBoutIds includes confirmed orphan-end rows', () => {
    expect(
      buildMatCompletedBoutIds([
        {
          boutId: 'bout-1',
          boutPhase: 'confirmed',
          actualStartAt: null,
          actualEndAt: new Date(),
        },
        {
          boutId: 'bout-2',
          boutPhase: 'scheduled',
          actualStartAt: null,
          actualEndAt: null,
        },
      ]),
    ).toEqual(new Set(['bout-1']))
  })
})
