import { describe, expect, it } from 'vitest'
import { resolveEffectiveBoutStoppage } from '../resolveEffectiveBoutStoppage'
import type { BoutEventRecord } from '../mat-control/types'

function stoppageEvent(
  partial: Partial<BoutEventRecord> & { id: string; boutElapsedMs: number },
): BoutEventRecord {
  return {
    boutId: 'bout-1',
    clientEventId: partial.id,
    sequence: 0,
    eventType: 'BOUT_STOPPAGE',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: null,
    period: 'main',
    attemptNumber: 1,
    undoneAt: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    payload: {
      trigger: 'SUBMISSION',
      boutElapsedMs: partial.boutElapsedMs,
    },
    ...partial,
  }
}

describe('resolveEffectiveBoutStoppage', () => {
  it('returns the latest non-undone BOUT_STOPPAGE', () => {
    const resolved = resolveEffectiveBoutStoppage([
      stoppageEvent({ id: 'first', boutElapsedMs: 90_000, sequence: 1 }),
      stoppageEvent({ id: 'second', boutElapsedMs: 42_000, sequence: 2 }),
    ])

    expect(resolved).toEqual({
      eventId: 'second',
      boutElapsedMs: 42_000,
      trigger: 'SUBMISSION',
    })
  })

  it('skips undone stoppages and uses the previous active one', () => {
    const resolved = resolveEffectiveBoutStoppage([
      stoppageEvent({ id: 'first', boutElapsedMs: 90_000, sequence: 1 }),
      stoppageEvent({
        id: 'cancelled',
        boutElapsedMs: 10_000,
        sequence: 2,
        undoneAt: new Date('2026-01-01T10:01:00.000Z'),
      }),
      stoppageEvent({ id: 'final', boutElapsedMs: 35_000, sequence: 3 }),
    ])

    expect(resolved).toEqual({
      eventId: 'final',
      boutElapsedMs: 35_000,
      trigger: 'SUBMISSION',
    })
  })

  it('reads boutElapsedMs from payload when event field is null', () => {
    const resolved = resolveEffectiveBoutStoppage([
      stoppageEvent({
        id: 'payload-only',
        boutElapsedMs: null as unknown as number,
        payload: { trigger: 'CLEAR_ADVANTAGE', boutElapsedMs: 18_000 },
      }),
    ])

    expect(resolved).toEqual({
      eventId: 'payload-only',
      boutElapsedMs: 18_000,
      trigger: 'CLEAR_ADVANTAGE',
    })
  })

  it('returns null when there is no active stoppage', () => {
    expect(resolveEffectiveBoutStoppage([])).toBeNull()
  })
})
