import { describe, expect, it } from 'vitest'
import {
  assertCompletedBoutHasFrozenNumber,
  resolveNextStartableBoutIdForFreeze,
} from '../freezeScheduleNumber'
import { InvalidScheduleInvariantError } from '../errors'
import type { ScheduledBout } from '../scheduleTypes'

describe('freezeScheduleNumber invariants', () => {
  it('requires frozen number for completed bout', () => {
    expect(() =>
      assertCompletedBoutHasFrozenNumber({
        boutId: 'cat::bout-1',
        actualStartAt: new Date('2026-01-01T10:00:00Z'),
        actualEndAt: new Date('2026-01-01T10:05:00Z'),
        frozenScheduleFormatted: null,
      }),
    ).toThrow(InvalidScheduleInvariantError)
  })

  it('allows completed bout with frozen number', () => {
    expect(() =>
      assertCompletedBoutHasFrozenNumber({
        boutId: 'cat::bout-1',
        actualStartAt: new Date('2026-01-01T10:00:00Z'),
        actualEndAt: new Date('2026-01-01T10:05:00Z'),
        frozenScheduleFormatted: '1-3',
      }),
    ).not.toThrow()
  })

  it('ignores bouts that are not completed', () => {
    expect(() =>
      assertCompletedBoutHasFrozenNumber({
        boutId: 'cat::bout-1',
        actualStartAt: null,
        actualEndAt: null,
        frozenScheduleFormatted: null,
      }),
    ).not.toThrow()
  })
})

function boutShell(id: string, matIndex: number): ScheduledBout {
  return {
    id,
    matchNumber: 1,
    scheduleDisplayNumber: '',
    schedulePosition: 0,
    matId: null,
    matNumber: matIndex,
    isFrozen: false,
    isInEditableZone: false,
    isNextStartable: false,
    matIndex,
    categoryKey: 'cat',
    categoryTitle: 'Cat',
    discipline: 'tactic_control',
    competitionStage: 'main',
    schedulePhase: 'main',
    sideA: { kind: 'athlete', entryId: `${id}-a`, displayName: 'A' },
    sideB: { kind: 'athlete', entryId: `${id}-b`, displayName: 'B' },
    timing: {
      durationMinutes: 3,
      scheduledStartAt: '2026-01-01T10:00:00.000Z',
      scheduledEndAt: '2026-01-01T10:03:00.000Z',
      estimatedStartAt: '2026-01-01T10:00:00.000Z',
      estimatedEndAt: '2026-01-01T10:03:00.000Z',
      status: 'upcoming',
      delayMinutes: 0,
      isDelayed: false,
    },
  }
}

describe('resolveNextStartableBoutIdForFreeze', () => {
  it('uses the bout mat queue when mats are enabled', () => {
    const snapshot = {
      matsEnabled: true,
      mats: [
        { matIndex: 1, bouts: [boutShell('mat1-a', 1), boutShell('mat1-b', 1)] },
        { matIndex: 2, bouts: [boutShell('mat2-a', 2), boutShell('mat2-b', 2)] },
      ],
      executions: new Map(),
    }

    expect(resolveNextStartableBoutIdForFreeze('mat2-a', snapshot)).toBe('mat2-a')
    expect(resolveNextStartableBoutIdForFreeze('mat1-b', snapshot)).toBe('mat1-a')
  })
})
