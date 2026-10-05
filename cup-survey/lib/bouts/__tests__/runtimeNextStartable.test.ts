import { describe, expect, it } from 'vitest'
import {
  applyRuntimeNextStartableFlags,
  reorderScheduledBoutsByRuntimeOrder,
  resolveRuntimeNextStartableBoutId,
} from '../runtimeNextStartable'
import type { InternalBout } from '../types'
import type { ScheduledBout } from '../scheduleTypes'

function internalBout(id: string): InternalBout {
  return {
    id,
    matchNumber: 1,
    categoryKey: 'cat',
    categoryTitle: 'Cat',
    discipline: 'tactic_control',
    competitionStage: 'main',
    schedulePhase: 'main',
    matIndex: 1,
    sideA: { kind: 'athlete', entryId: `${id}-a`, displayName: 'A' },
    sideB: { kind: 'athlete', entryId: `${id}-b`, displayName: 'B' },
  }
}

function scheduledBout(id: string): ScheduledBout {
  return {
    id,
    matchNumber: 1,
    scheduleDisplayNumber: '',
    schedulePosition: 0,
    matId: null,
    matNumber: 1,
    isFrozen: false,
    isInEditableZone: false,
    isNextStartable: false,
    matIndex: 1,
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

describe('runtimeNextStartable', () => {
  it('marks the first pending bout in runtime order as next startable', () => {
    const ordered = applyRuntimeNextStartableFlags(
      [internalBout('b'), internalBout('a')],
      1,
      new Map(),
    )

    expect(ordered[0]?.isNextStartable).toBe(true)
    expect(ordered[1]?.isNextStartable).toBe(false)
    expect(resolveRuntimeNextStartableBoutId(['b', 'a'], 1, new Map())).toBe('b')
  })

  it('reorders scheduled bouts to match runtime order', () => {
    const scheduled = [scheduledBout('a'), scheduledBout('b')]
    const runtime = [internalBout('b'), internalBout('a')]

    expect(reorderScheduledBoutsByRuntimeOrder(scheduled, runtime).map((bout) => bout.id)).toEqual([
      'b',
      'a',
    ])
  })
})
