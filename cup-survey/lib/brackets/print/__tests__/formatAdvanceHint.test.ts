import { describe, expect, it } from 'vitest'

import { formatAdvanceHintFromMatch, formatAdvanceHintFromSource } from '../formatAdvanceHint'

describe('formatAdvanceHint', () => {
  it('formats winner and loser hints from feeder match number', () => {
    const rounds = [
      {
        id: 'sf1',
        round: 1,
        slot: 1,
        matchNumber: 2,
        participantA: null,
        participantB: null,
      },
    ]

    const scheduleDisplayByBoutId = new Map([['cat-a::sf1', '1-2']])
    expect(
      formatAdvanceHintFromSource(rounds, { matchId: 'sf1', outcome: 'winner' }, {
        categoryKey: 'cat-a',
        released: true,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Победитель боя 1-2')
    expect(
      formatAdvanceHintFromSource(rounds, { matchId: 'sf1', outcome: 'loser' }, {
        categoryKey: 'cat-a',
        released: true,
        scheduleDisplayByBoutId,
      }),
    ).toBe('Проигравший боя 1-2')
  })

  it('uses schedule display numbers before neutral hints when bouts are not released', () => {
    expect(
      formatAdvanceHintFromSource(
        [
          {
            id: 'sf1',
            round: 1,
            slot: 1,
            matchNumber: 2,
            participantA: null,
            participantB: null,
          },
        ],
        { matchId: 'sf1', outcome: 'winner' },
        {
          categoryKey: 'cat-a',
          released: false,
          scheduleDisplayByBoutId: new Map([['cat-a::sf1', '2-12']]),
        },
      ),
    ).toBe('Победитель боя 2-12')
  })

  it('formats hints from match outcome', () => {
    expect(
      formatAdvanceHintFromMatch(
        {
          id: 'fin',
          round: 2,
          slot: 1,
          matchNumber: 3,
          participantA: null,
          participantB: null,
        },
        'WINNER',
        {
          categoryKey: 'cat-a',
          released: true,
          scheduleDisplayByBoutId: new Map([['cat-a::fin', '2-1']]),
        },
      ),
    ).toBe('Победитель боя 2-1')
  })
})
