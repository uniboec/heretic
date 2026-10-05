import { describe, expect, it } from 'vitest'
import { collectFightClubIdentities, countsAsFight } from '../boutStats'

const contestedMethods = [
  'POINTS',
  'CLEAR_ADVANTAGE',
  'SUBMISSION',
  'CHOKE',
  'DISQUALIFICATION',
  'INJURY',
  'FORFEIT',
  'TECHNICAL_SUPERIORITY',
  'KNOCKOUT',
  'TECHNICAL_KNOCKOUT',
] as const

describe('boutStats', () => {
  it('counts contested victory methods as fights', () => {
    for (const method of contestedMethods) {
      expect(countsAsFight(method)).toBe(true)
    }
  })

  it('counts NO_SHOW as win-capable but not a fight', () => {
    expect(countsAsFight('NO_SHOW')).toBe(false)
  })

  it('awards at most one fight per club in an intra-club bout', () => {
    const clubs = collectFightClubIdentities({
      winnerEntryId: 'a',
      loserEntryId: 'b',
      victoryMethod: 'POINTS',
      winnerClubIdentity: 'Club::City',
      loserClubIdentity: 'Club::City',
    })

    expect(clubs).toEqual(['Club::City'])
  })

  it('awards one fight to each club in a normal bout', () => {
    const clubs = collectFightClubIdentities({
      winnerEntryId: 'a',
      loserEntryId: 'b',
      victoryMethod: 'POINTS',
      winnerClubIdentity: 'Club A::City',
      loserClubIdentity: 'Club B::City',
    })

    expect(clubs).toHaveLength(2)
    expect(clubs).toContain('Club A::City')
    expect(clubs).toContain('Club B::City')
  })

  it('does not award fights for NO_SHOW', () => {
    const clubs = collectFightClubIdentities({
      winnerEntryId: 'a',
      loserEntryId: 'b',
      victoryMethod: 'NO_SHOW',
      winnerClubIdentity: 'Club A::City',
      loserClubIdentity: 'Club B::City',
    })

    expect(clubs).toEqual([])
  })

  it('awards fights for DQ, injury and forfeit', () => {
    for (const method of ['DISQUALIFICATION', 'INJURY', 'FORFEIT'] as const) {
      const clubs = collectFightClubIdentities({
        winnerEntryId: 'a',
        loserEntryId: 'b',
        victoryMethod: method,
        winnerClubIdentity: 'Club A::City',
        loserClubIdentity: 'Club B::City',
      })
      expect(clubs).toHaveLength(2)
    }
  })
})
