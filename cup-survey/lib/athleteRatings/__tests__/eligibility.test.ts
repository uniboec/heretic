import { describe, expect, it } from 'vitest'
import { resolveVictoryOutcome } from '../eligibility'
import type { AthleteRatingSettings } from '../types'

const settings: AthleteRatingSettings = {
  tournamentScopeId: 'cup-2026',
  publicEnabled: false,
  publicTopLimit: 10,
  firstPlacePoints: 60,
  secondPlacePoints: 35,
  thirdPlacePoints: 15,
  placeWithoutWinPercent: 20,
  pointsVictoryPoints: 32,
  clearAdvantageVictoryPoints: 36,
  submissionVictoryPoints: 40,
  chokeVictoryPoints: 40,
  injuryVictoryPoints: 20,
  dqVictoryPoints: 10,
  ageCoefficients: {
    '4-5': 35,
    '6-7': 45,
    '8-9': 60,
    '10-11': 75,
    '12-13': 88,
    '14-15': 100,
    '16-17': 105,
    '18+': 110,
  },
}

describe('resolveVictoryOutcome', () => {
  it('counts injury only after fight started', () => {
    expect(resolveVictoryOutcome('INJURY', false, settings).countableWin).toBe(false)
    expect(resolveVictoryOutcome('INJURY', true, settings).points).toBe(20)
  })

  it('treats forfeit and no-show as zero', () => {
    expect(resolveVictoryOutcome('FORFEIT', true, settings).countableWin).toBe(false)
    expect(resolveVictoryOutcome('NO_SHOW', true, settings).points).toBe(0)
    expect(resolveVictoryOutcome('FORFEIT', true, settings).forfeit).toBe(true)
  })

  it('counts dq only after fight started', () => {
    expect(resolveVictoryOutcome('DISQUALIFICATION', false, settings).countableWin).toBe(false)
    expect(resolveVictoryOutcome('DISQUALIFICATION', true, settings).dq).toBe(true)
    expect(resolveVictoryOutcome('DISQUALIFICATION', true, settings).points).toBe(10)
  })

  it('treats unknown methods as non-countable', () => {
    expect(resolveVictoryOutcome('WALKOVER', true, settings).countableWin).toBe(false)
    expect(resolveVictoryOutcome('WALKOVER', true, settings).points).toBe(0)
  })
})
