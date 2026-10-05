import { describe, expect, it } from 'vitest'
import { formatMatControlEvent } from '../presentation/formatMatControlEvent'
import type { BoutEventRecord, BoutEventType } from '../mat-control/types'

function event(
  eventType: BoutEventType,
  partial: Partial<BoutEventRecord> = {},
): BoutEventRecord {
  return {
    id: partial.id ?? 'evt-1',
    boutId: 'bout-1',
    sequence: partial.sequence ?? 0,
    attemptNumber: 1,
    undoneAt: partial.undoneAt ?? null,
    createdAt: partial.createdAt ?? new Date('2026-09-30T10:00:00.000Z'),
    clientEventId: partial.clientEventId ?? 'client-1',
    entryId: partial.entryId ?? null,
    cornerAtEvent: partial.cornerAtEvent ?? 'red',
    points: partial.points ?? null,
    episodeId: partial.episodeId ?? null,
    boutElapsedMs: partial.boutElapsedMs ?? null,
    period: partial.period ?? 'main',
    payload: partial.payload ?? null,
    eventType,
  }
}

describe('formatMatControlEvent', () => {
  it('formats technical score for red corner', () => {
    expect(
      formatMatControlEvent(event('TECHNICAL_SCORE', { cornerAtEvent: 'red', points: 4 })),
    ).toBe('Красному +4 балла')
  })

  it('formats technical score with action label', () => {
    expect(
      formatMatControlEvent(
        event('TECHNICAL_SCORE', {
          cornerAtEvent: 'blue',
          points: 2,
          payload: { source: 'DIRECT', action: 'REVERSAL_CONTROL' },
        }),
      ),
    ).toBe('Синему +2 · Реверс')
  })

  it('formats first call', () => {
    expect(formatMatControlEvent(event('FIRST_CALL', { cornerAtEvent: 'blue' }))).toBe(
      'Первичный вызов: синий угол',
    )
  })

  it('marks undone events', () => {
    expect(
      formatMatControlEvent(
        event('CLOCK_START', { undoneAt: new Date('2026-09-30T10:01:00.000Z') }),
      ),
    ).toBe('Время запущено (отменено)')
  })

  it('covers every BoutEventType', () => {
    const types: BoutEventType[] = [
      'TECHNICAL_SCORE',
      'PENALTY',
      'BOUT_STOPPAGE',
      'PASSIVITY_START',
      'PASSIVITY_END',
      'FIRST_CALL',
      'SECONDARY_CALL',
      'ATHLETE_WAIT_START',
      'ATHLETE_WAIT_END',
      'ATHLETE_DOCTOR_START',
      'ATHLETE_DOCTOR_END',
      'ATHLETE_EQUIPMENT_START',
      'ATHLETE_EQUIPMENT_END',
      'PERIOD_ENDED',
      'CLOCK_START',
      'CLOCK_STOP',
      'CLOCK_ADJUST',
      'CORNER_SWAP',
      'ADJUDICATION',
      'EXTRA_ACTIVITY_DECISION',
      'STOPPAGE_CANCELLED',
      'RESULT_CONFIRMED',
      'UNDO',
    ]
    for (const eventType of types) {
      expect(formatMatControlEvent(event(eventType))).toBeTruthy()
    }
  })
})
