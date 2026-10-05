import { describe, expect, it } from 'vitest'
import { buildBoutConfirmationSummary } from '../formatBoutConfirmation'
import type { BoutDecision, BoutEventRecord } from '../mat-control/types'

describe('buildBoutConfirmationSummary', () => {
  it('formats submission victory with subtype', () => {
    const decision: BoutDecision = {
      winnerEntryId: 'red-1',
      loserEntryId: 'blue-1',
      reason: 'SUBMISSION',
      decidedInPeriod: 'main',
      details: { submissionSubtype: 'ARM' },
    }

    const summary = buildBoutConfirmationSummary({
      events: [
        {
          id: 'evt-1',
          boutId: 'bout-1',
          clientEventId: 'stop-1',
          sequence: 1,
          eventType: 'BOUT_STOPPAGE',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 0,
          period: 'main',
          attemptNumber: 1,
          payload: {
            proposedVictoryMethod: 'SUBMISSION',
            submissionSubtype: 'ARM',
          },
          undoneAt: null,
          createdAt: new Date(),
        },
      ],
      decision,
      redEntryId: 'red-1',
      blueEntryId: 'blue-1',
      redName: 'Иванов',
      blueName: 'Петров',
      mainRedScore: 4,
      mainBlueScore: 2,
    })

    expect(summary.winnerLabel).toBe('Иванов')
    expect(summary.victoryMethodLabel).toBe('Б.П. (рука)')
    expect(summary.mainScore).toBe('4:2')
    expect(summary.countsForFastestFights).toBe(false)
    expect(summary.fastestFightTimeLabel).toBeNull()
  })

  it('marks eligible fastest fights with elapsed time label', () => {
    const summary = buildBoutConfirmationSummary({
      events: [
        {
          id: 'evt-0',
          boutId: 'bout-1',
          clientEventId: 'clock-1',
          sequence: 0,
          eventType: 'CLOCK_START',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 0,
          period: 'main',
          attemptNumber: 1,
          payload: null,
          undoneAt: null,
          createdAt: new Date(),
        },
        {
          id: 'evt-1',
          boutId: 'bout-1',
          clientEventId: 'stop-1',
          sequence: 1,
          eventType: 'BOUT_STOPPAGE',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 42_000,
          period: 'main',
          attemptNumber: 1,
          payload: {
            trigger: 'SUBMISSION',
            proposedVictoryMethod: 'SUBMISSION',
            submissionSubtype: 'ARM',
            boutElapsedMs: 42_000,
          },
          undoneAt: null,
          createdAt: new Date(),
        },
      ],
      decision: {
        winnerEntryId: 'red-1',
        loserEntryId: 'blue-1',
        reason: 'SUBMISSION',
        decidedInPeriod: 'main',
        details: { submissionSubtype: 'ARM' },
      },
      redEntryId: 'red-1',
      blueEntryId: 'blue-1',
      redName: 'Иванов',
      blueName: 'Петров',
      mainRedScore: 4,
      mainBlueScore: 2,
    })

    expect(summary.countsForFastestFights).toBe(true)
    expect(summary.fastestFightTimeLabel).toBe('0:42')
  })

  it('shows stoppage injury winner even when score is tied', () => {
    const summary = buildBoutConfirmationSummary({
      events: [
        {
          id: 'evt-1',
          boutId: 'bout-1',
          clientEventId: 'stop-1',
          sequence: 1,
          eventType: 'BOUT_STOPPAGE',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 0,
          period: 'main',
          attemptNumber: 1,
          payload: {
            proposedVictoryMethod: 'INJURY',
            winnerEntryId: 'blue-1',
            loserEntryId: 'red-1',
          },
          undoneAt: null,
          createdAt: new Date(),
        },
      ],
      decision: {
        winnerEntryId: 'blue-1',
        loserEntryId: 'red-1',
        reason: 'INJURY',
        decidedInPeriod: 'main',
      },
      redEntryId: 'red-1',
      blueEntryId: 'blue-1',
      redName: 'Иванов Кирилл',
      blueName: 'Павлов Максим',
      mainRedScore: 0,
      mainBlueScore: 0,
    })

    expect(summary.winnerLabel).toBe('Павлов Максим')
    expect(summary.victoryMethodLabel).toBe('Н.П.Б.')
    expect(summary.mainScore).toBe('0:0')
    expect(summary.countsForFastestFights).toBe(false)
  })

  it('shows Активнее for extra activity decision instead of П.Б.', () => {
    const summary = buildBoutConfirmationSummary({
      events: [
        {
          id: 'evt-1',
          boutId: 'bout-1',
          clientEventId: 'stop-1',
          sequence: 1,
          eventType: 'BOUT_STOPPAGE',
          entryId: null,
          cornerAtEvent: null,
          points: null,
          episodeId: null,
          boutElapsedMs: 0,
          period: 'extra',
          attemptNumber: 1,
          payload: {
            proposedVictoryMethod: 'POINTS',
            proposedDecisionReason: 'EXTRA_ACTIVITY',
          },
          undoneAt: null,
          createdAt: new Date(),
        },
      ],
      decision: {
        winnerEntryId: 'red-1',
        loserEntryId: 'blue-1',
        reason: 'EXTRA_ACTIVITY',
        decidedInPeriod: 'extra',
      },
      redEntryId: 'red-1',
      blueEntryId: 'blue-1',
      redName: 'Красный',
      blueName: 'Синий',
      mainRedScore: 2,
      mainBlueScore: 2,
      extraRedScore: 2,
      extraBlueScore: 2,
    })

    expect(summary.victoryMethodLabel).toBe('Активнее')
  })
})
