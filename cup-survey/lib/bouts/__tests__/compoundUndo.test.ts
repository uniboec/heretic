import { describe, expect, it } from 'vitest'
import { applyCompoundUndo } from '../compoundUndo'
import type { BoutEventRecord, MatControlExecution } from '../mat-control/types'

const baseExecution: MatControlExecution = {
  id: 'exec-1',
  boutId: 'bout-1',
  tournamentScopeId: 'cup-2026',
  actualStartAt: null,
  actualEndAt: null,
  officialStartedAt: null,
  officialEndedAt: null,
  mainEndedAt: null,
  extraEndedAt: null,
  activityCorrectionMode: false,
  periodCorrectionMode: false,
  attemptNumber: 1,
  boutPhase: 'live',
  clockState: 'running',
  clockStartedAt: new Date(),
  clockElapsedBeforeStartMs: 0,
  currentPeriod: 'main',
  nextEventSequence: 3,
  liveRevision: 1,
  liveSnapshot: null,
}

function event(partial: Partial<BoutEventRecord> & Pick<BoutEventRecord, 'id' | 'eventType'>): BoutEventRecord {
  return {
    boutId: 'bout-1',
    clientEventId: partial.id,
    sequence: partial.sequence ?? 1,
    entryId: partial.entryId ?? 'red-1',
    cornerAtEvent: partial.cornerAtEvent ?? 'red',
    points: partial.points ?? 2,
    episodeId: partial.episodeId ?? 'ep-1',
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: partial.payload ?? null,
    undoneAt: partial.undoneAt ?? null,
    createdAt: new Date(),
    ...partial,
  }
}

describe('compoundUndo', () => {
  it('undoes simultaneous technical episode atomically', () => {
    const events = [
      event({ id: 'e1', eventType: 'TECHNICAL_SCORE', cornerAtEvent: 'red', episodeId: 'ep-sim', sequence: 1 }),
      event({ id: 'e2', eventType: 'TECHNICAL_SCORE', cornerAtEvent: 'blue', episodeId: 'ep-sim', sequence: 2 }),
    ]

    const result = applyCompoundUndo({
      execution: baseExecution,
      events,
      payload: { targetEpisodeId: 'ep-sim' },
      now: new Date(),
      operationId: 'op-1',
    })

    expect(result.undoEvent.eventType).toBe('UNDO')
    expect(result.undoneEvents.filter((item) => item.undoneAt).length).toBe(2)
  })

  it('undoes adjudication score together with its technical score event', () => {
    const events = [
      event({
        id: 'score-1',
        eventType: 'TECHNICAL_SCORE',
        episodeId: 'ep-adj',
        payload: { source: 'ADJUDICATION' },
        sequence: 1,
      }),
      event({
        id: 'adj-1',
        eventType: 'ADJUDICATION',
        episodeId: 'ep-adj',
        payload: { episodeId: 'ep-adj', points: 2 },
        sequence: 2,
      }),
    ]

    const result = applyCompoundUndo({
      execution: baseExecution,
      events,
      payload: {},
      now: new Date(),
      operationId: 'op-adj-undo',
    })

    expect(result.undoneEvents.filter((item) => item.undoneAt).map((item) => item.id)).toEqual([
      'score-1',
      'adj-1',
    ])
  })

  it('undoes athlete wait end together with bundled late-appearance penalties', () => {
    const events = [
      event({
        id: 'wait-end',
        eventType: 'ATHLETE_WAIT_END',
        points: null,
        sequence: 1,
      }),
      event({
        id: 'penalty-1',
        eventType: 'PENALTY',
        points: 0,
        payload: { ladder: 'GENERAL', sanction: 'REMARK' },
        sequence: 2,
      }),
    ]

    const result = applyCompoundUndo({
      execution: baseExecution,
      events,
      payload: {},
      now: new Date(),
      operationId: 'op-wait-undo',
    })

    expect(result.undoneEvents.filter((item) => item.undoneAt).map((item) => item.id)).toEqual([
      'wait-end',
      'penalty-1',
    ])
  })
})
