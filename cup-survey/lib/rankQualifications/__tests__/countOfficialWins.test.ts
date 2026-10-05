import { describe, expect, it } from 'vitest'
import { countOfficialWins } from '../countOfficialWins'

describe('countOfficialWins', () => {
  it('counts all official wins including technical methods', () => {
    const wins = countOfficialWins('entry-a', [
      {
        boutId: 'b1',
        winnerEntryId: 'entry-a',
        loserEntryId: 'entry-b',
        victoryMethod: 'POINTS',
      },
      {
        boutId: 'b2',
        winnerEntryId: 'entry-a',
        loserEntryId: 'entry-c',
        victoryMethod: 'DISQUALIFICATION',
      },
    ])
    expect(wins).toBe(2)
  })

  it('counts FORFEIT as an official win', () => {
    const wins = countOfficialWins('entry-a', [
      {
        boutId: 'b1',
        winnerEntryId: 'entry-a',
        loserEntryId: 'entry-b',
        victoryMethod: 'FORFEIT',
      },
    ])
    expect(wins).toBe(1)
  })

  it('does not count bouts where athlete is not winner', () => {
    const wins = countOfficialWins('entry-a', [
      {
        boutId: 'b1',
        winnerEntryId: 'entry-b',
        loserEntryId: 'entry-a',
        victoryMethod: 'FORFEIT',
      },
    ])
    expect(wins).toBe(0)
  })
})
