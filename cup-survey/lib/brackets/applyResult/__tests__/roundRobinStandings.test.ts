import { describe, expect, it } from 'vitest'
import { computeRoundRobinStandings } from '../roundRobinStandings'

describe('computeRoundRobinStandings', () => {
  it('aggregates wins and losses from completed pairs', () => {
    const standings = computeRoundRobinStandings([
      {
        entryIdA: 'a',
        entryIdB: 'b',
        round: 1,
        matchNumber: 1,
        winnerEntryId: 'a',
        loserEntryId: 'b',
      },
      {
        entryIdA: 'a',
        entryIdB: 'c',
        round: 2,
        matchNumber: 2,
        winnerEntryId: 'c',
        loserEntryId: 'a',
      },
      {
        entryIdA: 'b',
        entryIdB: 'c',
        round: 2,
        matchNumber: 3,
      },
    ])

    expect(standings.find((row) => row.entryId === 'a')).toEqual({
      entryId: 'a',
      wins: 1,
      losses: 1,
      played: 2,
    })
    expect(standings.find((row) => row.entryId === 'c')).toEqual({
      entryId: 'c',
      wins: 1,
      losses: 0,
      played: 1,
    })
  })
})
