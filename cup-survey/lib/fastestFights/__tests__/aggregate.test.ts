import { describe, expect, it } from 'vitest'
import { aggregateFastestFights } from '../aggregate'
import type { FastestFightBoutMeta, FastestFightParticipant } from '../types'

const participantsByEntryId = new Map<string, FastestFightParticipant>([
  [
    'winner-a',
    {
      entryId: 'winner-a',
      displayName: 'Иванов Иван',
      clubName: 'Клуб А',
      city: 'Екатеринбург',
    },
  ],
  [
    'winner-b',
    {
      entryId: 'winner-b',
      displayName: 'Петров Пётр',
      clubName: 'Клуб Б',
      city: 'Пермь',
    },
  ],
])

const boutMetaById = new Map<string, FastestFightBoutMeta>([
  [
    'cat::m1',
    {
      boutId: 'cat::m1',
      scheduleDisplayNumber: '1-12',
      categoryTitle: '12–13 лет, 66 кг',
      discipline: 'tactic_control',
    },
  ],
  [
    'cat::m2',
    {
      boutId: 'cat::m2',
      scheduleDisplayNumber: '1-5',
      categoryTitle: '14–15 лет, 70 кг',
      discipline: 'close_control',
    },
  ],
  [
    'cat::m3',
    {
      boutId: 'cat::m3',
      scheduleDisplayNumber: '1-8',
      categoryTitle: '16–17 лет, 74 кг',
      discipline: 'tactic_control',
    },
  ],
])

describe('aggregateFastestFights', () => {
  it('sorts by boutElapsedMs and limits to top 10', () => {
    const results = Array.from({ length: 12 }, (_, index) => ({
      boutId: `cat::m${index + 1}`,
      winnerEntryId: 'winner-a',
      victoryMethod: 'SUBMISSION',
      boutElapsedMs: (index + 1) * 10_000,
      resultConfirmedAt: new Date(`2026-01-01T10:${String(index).padStart(2, '0')}:00.000Z`),
    }))

    const aggregated = aggregateFastestFights({
      results,
      participantsByEntryId,
      boutMetaById: new Map(
        results.map((result, index) => [
          result.boutId,
          {
            boutId: result.boutId,
            scheduleDisplayNumber: `${index + 1}`,
            categoryTitle: `Категория ${index + 1}`,
            discipline: 'tactic_control',
          },
        ]),
      ),
    })

    expect(aggregated.totalEligible).toBe(12)
    expect(aggregated.rows).toHaveLength(10)
    expect(aggregated.rows[0]?.boutElapsedMs).toBe(10_000)
    expect(aggregated.rows[9]?.boutElapsedMs).toBe(100_000)
    expect(aggregated.rows[0]?.rank).toBe(1)
    expect(aggregated.rows[0]?.timeLabel).toBe('0:10')
  })

  it('uses resultConfirmedAt and scheduleDisplayNumber as tie-breakers', () => {
    const aggregated = aggregateFastestFights({
      results: [
        {
          boutId: 'cat::m2',
          winnerEntryId: 'winner-b',
          victoryMethod: 'CHOKE',
          boutElapsedMs: 30_000,
          resultConfirmedAt: new Date('2026-01-01T10:05:00.000Z'),
        },
        {
          boutId: 'cat::m1',
          winnerEntryId: 'winner-a',
          victoryMethod: 'SUBMISSION',
          boutElapsedMs: 30_000,
          resultConfirmedAt: new Date('2026-01-01T10:04:00.000Z'),
        },
      ],
      participantsByEntryId,
      boutMetaById,
    })

    expect(aggregated.rows.map((row) => row.boutId)).toEqual(['cat::m1', 'cat::m2'])
  })

  it('excludes sub-second elapsed time and non-eligible victory methods', () => {
    const aggregated = aggregateFastestFights({
      results: [
        {
          boutId: 'cat::m1',
          winnerEntryId: 'winner-a',
          victoryMethod: 'SUBMISSION',
          boutElapsedMs: 250,
          resultConfirmedAt: new Date('2026-01-01T10:00:00.000Z'),
        },
        {
          boutId: 'cat::m2',
          winnerEntryId: 'winner-b',
          victoryMethod: 'FORFEIT',
          boutElapsedMs: 15_000,
          resultConfirmedAt: new Date('2026-01-01T10:01:00.000Z'),
        },
        {
          boutId: 'cat::m3',
          winnerEntryId: 'winner-a',
          victoryMethod: 'CLEAR_ADVANTAGE',
          boutElapsedMs: 25_000,
          resultConfirmedAt: new Date('2026-01-01T10:02:00.000Z'),
        },
      ],
      participantsByEntryId,
      boutMetaById,
    })

    expect(aggregated.totalEligible).toBe(1)
    expect(aggregated.rows).toHaveLength(1)
    expect(aggregated.rows[0]?.victoryMethod).toBe('CLEAR_ADVANTAGE')
    expect(aggregated.rows[0]?.victoryMethodLabel).toBe('Явное преимущество')
  })

  it('formats full victory method labels including submission subtype', () => {
    const aggregated = aggregateFastestFights({
      results: [
        {
          boutId: 'cat::m1',
          winnerEntryId: 'winner-a',
          victoryMethod: 'SUBMISSION',
          submissionSubtype: 'LEG',
          boutElapsedMs: 42_000,
          resultConfirmedAt: new Date('2026-01-01T10:00:00.000Z'),
        },
      ],
      participantsByEntryId,
      boutMetaById,
    })

    expect(aggregated.rows[0]?.victoryMethodLabel).toBe('Болевой приём на ногу')
  })
})
