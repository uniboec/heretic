import { describe, expect, it } from 'vitest'
import {
  assertBoutCanBeFrozen,
  assertFrozenPrefixInvariant,
  computeScheduleDisplayNumbers,
  formatScheduleDisplayNumber,
  hasFrozenPrefixViolation,
  resolveNextStartableBoutId,
} from '../scheduleDisplayNumber'
import { BoutNotNextInScheduleError, InvalidScheduleInvariantError } from '../errors'
import type { ScheduledBout } from '../scheduleTypes'

function makeBout(id: string, matIndex: number, startAt: string): ScheduledBout {
  return {
    id,
    matchNumber: 1,
    scheduleDisplayNumber: '',
    schedulePosition: 0,
    matId: null,
    matNumber: null,
    isFrozen: false,
    isInEditableZone: false,
    isNextStartable: false,
    matIndex,
    categoryKey: 'cat:a',
    categoryTitle: 'Cat',
    discipline: 'FS',
    competitionStage: 1,
    schedulePhase: 'elimination',
    sideA: { kind: 'bye' },
    sideB: { kind: 'bye' },
    timing: {
      durationMinutes: 3,
      scheduledStartAt: startAt,
      scheduledEndAt: startAt,
      estimatedStartAt: startAt,
      estimatedEndAt: startAt,
      status: 'upcoming',
      delayMinutes: 0,
      isDelayed: false,
    },
  }
}

describe('scheduleDisplayNumber', () => {
  it('formats mats and global modes', () => {
    expect(formatScheduleDisplayNumber(1, 3, true)).toBe('1-3')
    expect(formatScheduleDisplayNumber(null, 5, false)).toBe('5')
  })

  it('assigns per-mat positions when matsEnabled=true', () => {
    const map = computeScheduleDisplayNumbers({
      matsEnabled: true,
      mats: [
        {
          matIndex: 1,
          bouts: [makeBout('a', 1, '2026-10-02T10:00:00.000Z')],
        },
        {
          matIndex: 2,
          bouts: [makeBout('b', 2, '2026-10-02T10:03:00.000Z')],
        },
      ],
      executions: new Map(),
    })

    expect(map.get('a')?.scheduleDisplayNumber).toBe('1-1')
    expect(map.get('b')?.scheduleDisplayNumber).toBe('2-1')
  })

  it('rejects frozen prefix gaps', () => {
    expect(() =>
      assertFrozenPrefixInvariant([
        { boutId: 'a', matIndex: 1, isFrozen: true },
        { boutId: 'b', matIndex: 1, isFrozen: false },
        { boutId: 'c', matIndex: 1, isFrozen: true },
      ]),
    ).toThrow(InvalidScheduleInvariantError)
  })

  it('detects frozen prefix violations without throwing', () => {
    const mats = [
      {
        matIndex: 1,
        bouts: [
          makeBout('a', 1, '2026-10-02T10:00:00.000Z'),
          makeBout('b', 1, '2026-10-02T10:03:00.000Z'),
          makeBout('c', 1, '2026-10-02T10:06:00.000Z'),
        ],
      },
    ]
    const executions = new Map([
      [
        'a',
        {
          boutId: 'a',
          actualStartAt: new Date('2026-10-02T10:00:00.000Z'),
          actualEndAt: new Date('2026-10-02T10:03:00.000Z'),
          frozenScheduleFormatted: '1-1',
          frozenScheduleMatNumber: 1,
          frozenSchedulePosition: 1,
        },
      ],
      [
        'c',
        {
          boutId: 'c',
          actualStartAt: new Date('2026-10-02T10:06:00.000Z'),
          actualEndAt: new Date('2026-10-02T10:09:00.000Z'),
          frozenScheduleFormatted: '1-3',
          frozenScheduleMatNumber: 1,
          frozenSchedulePosition: 3,
        },
      ],
    ])

    expect(
      hasFrozenPrefixViolation({
        matsEnabled: true,
        mats,
        executions,
      }),
    ).toBe(true)
    expect(
      hasFrozenPrefixViolation({
        matsEnabled: true,
        mats: [
          {
            matIndex: 1,
            bouts: [mats[0].bouts[0], mats[0].bouts[2], mats[0].bouts[1]],
          },
        ],
        executions,
      }),
    ).toBe(false)
  })

  it('requires next startable bout for freeze', () => {
    expect(() => assertBoutCanBeFrozen('b', 'a')).toThrow(BoutNotNextInScheduleError)
    expect(() => assertBoutCanBeFrozen('a', 'a')).not.toThrow()
  })

  it('recomputes legacy placeholder frozen numbers that do not match mat queue position', () => {
    const map = computeScheduleDisplayNumbers({
      matsEnabled: true,
      mats: [
        {
          matIndex: 2,
          bouts: [makeBout('legacy', 2, '2026-10-02T10:00:00.000Z')],
        },
      ],
      executions: new Map([
        [
          'legacy',
          {
            boutId: 'legacy',
            actualStartAt: new Date('2026-10-02T10:00:00.000Z'),
            actualEndAt: new Date('2026-10-02T10:03:00.000Z'),
            frozenScheduleFormatted: '1-31',
            frozenScheduleMatNumber: 1,
            frozenSchedulePosition: 31,
          },
        ],
      ]),
      skipInvariantChecks: true,
    })

    expect(map.get('legacy')?.scheduleDisplayNumber).toBe('2-1')
  })

  it('keeps valid frozen numbers when legacy gap is enabled', () => {
    const map = computeScheduleDisplayNumbers({
      matsEnabled: true,
      mats: [
        {
          matIndex: 1,
          bouts: [
            makeBout('a', 1, '2026-10-02T10:00:00.000Z'),
            makeBout('b', 1, '2026-10-02T10:03:00.000Z'),
          ],
        },
      ],
      executions: new Map([
        [
          'a',
          {
            boutId: 'a',
            actualStartAt: new Date('2026-10-02T10:00:00.000Z'),
            actualEndAt: new Date('2026-10-02T10:03:00.000Z'),
            frozenScheduleFormatted: '1-1',
            frozenScheduleMatNumber: 1,
            frozenSchedulePosition: 1,
          },
        ],
      ]),
      skipInvariantChecks: true,
    })

    expect(map.get('a')?.scheduleDisplayNumber).toBe('1-1')
    expect(map.get('b')?.scheduleDisplayNumber).toBe('1-2')
  })

  it('resolves next startable bout after frozen prefix', () => {
    const queue = [
      {
        boutId: 'a',
        matIndex: 1,
        isFrozen: true,
        frozen: { formatted: '1-1', matNumber: 1, position: 1 },
      },
      { boutId: 'b', matIndex: 1, isFrozen: false },
      { boutId: 'c', matIndex: 1, isFrozen: false },
    ]
    expect(resolveNextStartableBoutId(queue, new Map())).toBe('b')
  })
})
