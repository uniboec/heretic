import { describe, expect, it } from 'vitest'
import { evaluateBracketForParticipant } from '../evaluateBracket'
import type { NormQualificationCategorySource } from '../types'

const category: NormQualificationCategorySource = {
  categoryKey: 'tactic_control:experienced:m_youths_2:m_youths_2_w_le_35',
  discipline: 'tactic_control',
  participants: [],
  result: { status: 'complete', placements: [] },
  boutResults: [],
}

describe('evaluateBracketForParticipant', () => {
  it('counts DQ win toward youth III norm', () => {
    const result = evaluateBracketForParticipant({
      category,
      entryId: 'entry-1',
      athleteId: 'athlete-1',
      birthDate: '2012-05-01',
      gender: 'male',
      placement: 1,
      boutResults: [
        {
          boutId: 'b1',
          winnerEntryId: 'entry-1',
          loserEntryId: 'entry-2',
          victoryMethod: 'DISQUALIFICATION',
        },
      ],
    })

    expect(result?.wins).toBe(1)
    expect(result?.achievedRank).toBe('youth_3')
  })

  it('returns null achieved rank for solo with zero bout results', () => {
    const result = evaluateBracketForParticipant({
      category,
      entryId: 'entry-1',
      athleteId: 'athlete-1',
      birthDate: '2012-05-01',
      gender: 'male',
      placement: 1,
      boutResults: [],
    })

    expect(result?.wins).toBe(0)
    expect(result?.achievedRank).toBeNull()
  })

  it('counts FORFEIT win toward youth III norm', () => {
    const result = evaluateBracketForParticipant({
      category,
      entryId: 'entry-1',
      athleteId: 'athlete-1',
      birthDate: '2012-05-01',
      gender: 'male',
      placement: 1,
      boutResults: [
        {
          boutId: 'b1',
          winnerEntryId: 'entry-1',
          loserEntryId: 'entry-2',
          victoryMethod: 'FORFEIT',
        },
      ],
    })

    expect(result?.wins).toBe(1)
    expect(result?.achievedRank).toBe('youth_3')
  })

  it('does not count BYE podium without official bout win', () => {
    const result = evaluateBracketForParticipant({
      category,
      entryId: 'entry-1',
      athleteId: 'athlete-1',
      birthDate: '2012-05-01',
      gender: 'male',
      placement: 1,
      boutResults: [
        {
          boutId: 'b1',
          winnerEntryId: 'entry-2',
          loserEntryId: 'entry-3',
          victoryMethod: 'POINTS',
        },
      ],
    })

    expect(result?.wins).toBe(0)
    expect(result?.achievedRank).toBeNull()
  })

  it('age-up in youths_2 grid uses child EVSK band (11 y.o., 1st, 2 wins → child II)', () => {
    const result = evaluateBracketForParticipant({
      category,
      entryId: 'entry-1',
      athleteId: 'athlete-1',
      birthDate: '2015-05-01',
      gender: 'male',
      placement: 1,
      boutResults: [
        {
          boutId: 'b1',
          winnerEntryId: 'entry-1',
          loserEntryId: 'entry-2',
          victoryMethod: 'POINTS',
        },
        {
          boutId: 'b2',
          winnerEntryId: 'entry-1',
          loserEntryId: 'entry-3',
          victoryMethod: 'FORFEIT',
        },
      ],
    })

    expect(result?.isAgeUp).toBe(true)
    expect(result?.evskAgeBand).toBe('child')
    expect(result?.achievedRank).toBe('child_2')
  })
})
