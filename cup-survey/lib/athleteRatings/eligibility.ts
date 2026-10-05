import { FORFEIT_VICTORY_POINTS } from './constants'
import type { AthleteRatingSettings } from './types'

export type VictoryOutcome = {
  points: number
  countableWin: boolean
  submissionChoke: boolean
  injury: boolean
  dq: boolean
  forfeit: boolean
}

const NON_COUNTABLE_METHODS = new Set(['FORFEIT', 'NO_SHOW'])

export function resolveVictoryOutcome(
  victoryMethod: string,
  fightOfficiallyStarted: boolean,
  settings: AthleteRatingSettings,
): VictoryOutcome {
  if (NON_COUNTABLE_METHODS.has(victoryMethod)) {
    return {
      points: FORFEIT_VICTORY_POINTS,
      countableWin: false,
      submissionChoke: false,
      injury: false,
      dq: false,
      forfeit: true,
    }
  }

  switch (victoryMethod) {
    case 'POINTS':
      return {
        points: settings.pointsVictoryPoints,
        countableWin: true,
        submissionChoke: false,
        injury: false,
        dq: false,
        forfeit: false,
      }
    case 'CLEAR_ADVANTAGE':
      return {
        points: settings.clearAdvantageVictoryPoints,
        countableWin: true,
        submissionChoke: false,
        injury: false,
        dq: false,
        forfeit: false,
      }
    case 'SUBMISSION':
      return {
        points: settings.submissionVictoryPoints,
        countableWin: true,
        submissionChoke: true,
        injury: false,
        dq: false,
        forfeit: false,
      }
    case 'CHOKE':
      return {
        points: settings.chokeVictoryPoints,
        countableWin: true,
        submissionChoke: true,
        injury: false,
        dq: false,
        forfeit: false,
      }
    case 'INJURY':
      if (!fightOfficiallyStarted) {
        return {
          points: FORFEIT_VICTORY_POINTS,
          countableWin: false,
          submissionChoke: false,
          injury: false,
          dq: false,
          forfeit: true,
        }
      }
      return {
        points: settings.injuryVictoryPoints,
        countableWin: true,
        submissionChoke: false,
        injury: true,
        dq: false,
        forfeit: false,
      }
    case 'DISQUALIFICATION':
      if (!fightOfficiallyStarted) {
        return {
          points: FORFEIT_VICTORY_POINTS,
          countableWin: false,
          submissionChoke: false,
          injury: false,
          dq: false,
          forfeit: true,
        }
      }
      return {
        points: settings.dqVictoryPoints,
        countableWin: true,
        submissionChoke: false,
        injury: false,
        dq: true,
        forfeit: false,
      }
    default:
      return {
        points: FORFEIT_VICTORY_POINTS,
        countableWin: false,
        submissionChoke: false,
        injury: false,
        dq: false,
        forfeit: false,
      }
  }
}
