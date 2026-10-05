import { describe, expect, it } from 'vitest'
import { assertCanCompleteBout, assertCanStartBout } from '../executionValidation'
import {
  BoutAlreadyInProgressError,
  BoutExecutionOutOfOrderError,
  BoutNotReadyError,
} from '../errors'
import type { ScheduledBout } from '../scheduleTypes'

function makeUpcomingBout(id: string, estimatedStartAt: string): ScheduledBout {
  return {
    id,
    matchNumber: 1,
    matIndex: 1,
    categoryKey: 'tactic_control:novice:m_boys_1:w1',
    categoryTitle: 'Test',
    discipline: 'tactic_control',
    sideA: { kind: 'bye' },
    sideB: { kind: 'bye' },
    timing: {
      durationMinutes: 2,
      scheduledStartAt: estimatedStartAt,
      scheduledEndAt: estimatedStartAt,
      estimatedStartAt,
      estimatedEndAt: estimatedStartAt,
      status: 'upcoming',
      delayMinutes: 0,
      isDelayed: false,
    },
  }
}

describe('executionValidation', () => {
  it('M5: rejects COMPLETE when mutationNow is before actualStartAt', () => {
    const actualStartAt = new Date('2026-10-03T06:00:00.000Z')
    const schedule = [
      {
        ...makeUpcomingBout('b1', actualStartAt.toISOString()),
        timing: {
          ...makeUpcomingBout('b1', actualStartAt.toISOString()).timing,
          status: 'in_progress' as const,
          actualStartAt: actualStartAt.toISOString(),
        },
      },
    ]

    expect(() =>
      assertCanCompleteBout({
        schedule,
        boutId: 'b1',
        mutationNow: new Date('2026-10-03T05:59:59.000Z'),
        actualStartAt,
      }),
    ).toThrow(BoutExecutionOutOfOrderError)
  })

  it('rejects START when bout is not the next upcoming', () => {
    const future = '2026-10-03T06:00:00.000Z'
    const schedule = [
      makeUpcomingBout('b1', future),
      makeUpcomingBout('b2', future),
    ]

    expect(() =>
      assertCanStartBout({
        schedule,
        boutId: 'b2',
        mutationNow: new Date(future),
        inProgressId: null,
      }),
    ).toThrow(BoutNotReadyError)
  })

  it('rejects START when mutationNow is before estimatedStartAt', () => {
    const future = '2026-10-03T06:00:00.000Z'
    const schedule = [makeUpcomingBout('b1', future)]

    expect(() =>
      assertCanStartBout({
        schedule,
        boutId: 'b1',
        mutationNow: new Date('2026-10-03T05:00:00.000Z'),
        inProgressId: null,
      }),
    ).toThrow(BoutNotReadyError)
  })

  it('rejects START when another bout is in progress', () => {
    const future = '2026-10-03T06:00:00.000Z'
    const schedule = [makeUpcomingBout('b1', future)]

    expect(() =>
      assertCanStartBout({
        schedule,
        boutId: 'b1',
        mutationNow: new Date(future),
        inProgressId: 'other',
      }),
    ).toThrow(BoutAlreadyInProgressError)
  })

  it('rejects COMPLETE when bout is not current in_progress', () => {
    const actualStartAt = new Date('2026-10-03T06:00:00.000Z')
    const schedule = [
      {
        ...makeUpcomingBout('b1', actualStartAt.toISOString()),
        timing: {
          ...makeUpcomingBout('b1', actualStartAt.toISOString()).timing,
          status: 'in_progress' as const,
          actualStartAt: actualStartAt.toISOString(),
        },
      },
    ]

    expect(() =>
      assertCanCompleteBout({
        schedule,
        boutId: 'b2',
        mutationNow: new Date('2026-10-03T06:05:00.000Z'),
        actualStartAt,
      }),
    ).toThrow(BoutExecutionOutOfOrderError)
  })
})
