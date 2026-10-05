import { describe, expect, it } from 'vitest'

import type { BoutEventRecord } from '@/lib/bouts/mat-control/types'

import {
  formatJudgeTimelineEntry,
  getJudgeTimelineEvents,
} from '../formatJudgeTimelineEntry'

function event(partial: Partial<BoutEventRecord> & Pick<BoutEventRecord, 'eventType'>): BoutEventRecord {
  return {
    id: partial.id ?? 'evt-1',
    boutId: 'bout-1',
    sequence: partial.sequence ?? 1,
    attemptNumber: partial.attemptNumber ?? 1,
    period: partial.period ?? 'main',
    eventType: partial.eventType,
    cornerAtEvent: partial.cornerAtEvent ?? null,
    points: partial.points ?? null,
    payload: partial.payload ?? null,
    boutElapsedMs: partial.boutElapsedMs ?? null,
    createdAt: partial.createdAt ?? new Date('2026-01-01T12:00:00Z'),
    undoneAt: partial.undoneAt ?? null,
    episodeId: partial.episodeId ?? null,
    actorUserId: partial.actorUserId ?? null,
  }
}

describe('formatJudgeTimelineEntry', () => {
  it('formats technical score with action label and bout time', () => {
    const entry = formatJudgeTimelineEntry(
      event({
        eventType: 'TECHNICAL_SCORE',
        cornerAtEvent: 'red',
        points: 4,
        boutElapsedMs: 15_000,
        payload: { action: 'FULL_CONTROL' },
      }),
    )

    expect(entry).toMatchObject({
      kind: 'score',
      corner: 'red',
      headline: '+4',
      subtitle: 'Фулл',
      boutTime: '0:15',
      title: 'Красному +4 · Фулл',
    })
  })

  it('formats reversal for blue corner', () => {
    const entry = formatJudgeTimelineEntry(
      event({
        eventType: 'TECHNICAL_SCORE',
        cornerAtEvent: 'blue',
        points: 2,
        boutElapsedMs: 20_000,
        payload: { action: 'REVERSAL_CONTROL' },
      }),
    )

    expect(entry).toMatchObject({
      kind: 'score',
      corner: 'blue',
      headline: '+2',
      subtitle: 'Реверс',
      boutTime: '0:20',
      title: 'Синему +2 · Реверс',
    })
  })

  it('formats penalty warning as opponent score with ladder label', () => {
    const entry = formatJudgeTimelineEntry(
      event({
        eventType: 'PENALTY',
        cornerAtEvent: 'red',
        points: 1,
        boutElapsedMs: 45_000,
        payload: { sanction: 'WARNING_1', awardedPoints: 1, ladder: 'OUT_OF_BOUNDS' },
      }),
    )

    expect(entry).toMatchObject({
      kind: 'score',
      corner: 'blue',
      headline: '+1',
      subtitle: 'Ковёр',
    })
  })

  it('uses a single-letter headline for doctor visit', () => {
    const entry = formatJudgeTimelineEntry(
      event({
        eventType: 'ATHLETE_DOCTOR_START',
        cornerAtEvent: 'red',
        boutElapsedMs: 30_000,
      }),
    )

    expect(entry).toMatchObject({
      headline: 'В',
      subtitle: 'У врача',
    })
  })

  it('filters undone, clock start, and previous attempts', () => {
    const events = getJudgeTimelineEvents(
      [
        event({ id: 'a', eventType: 'CLOCK_START', sequence: 1 }),
        event({
          id: 'b',
          eventType: 'TECHNICAL_SCORE',
          sequence: 2,
          cornerAtEvent: 'red',
          points: 1,
          attemptNumber: 1,
        }),
        event({ id: 'c', eventType: 'UNDO', sequence: 3, attemptNumber: 2 }),
        event({
          id: 'd',
          eventType: 'PENALTY',
          sequence: 4,
          undoneAt: new Date(),
          cornerAtEvent: 'blue',
          attemptNumber: 2,
        }),
        event({
          id: 'e',
          eventType: 'TECHNICAL_SCORE',
          sequence: 5,
          cornerAtEvent: 'blue',
          points: 2,
          attemptNumber: 2,
        }),
      ],
      2,
    )

    expect(events.map((item) => item.id)).toEqual(['e'])
  })
})
