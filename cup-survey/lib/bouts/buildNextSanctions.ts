import { nextSanctionOnLadder, type PenaltySanction } from '../config/fseRules'
import type { ScoreState } from './mat-control/types'

export type CornerNextSanctions = {
  general: PenaltySanction
  outOfBounds: PenaltySanction
  passivity: PenaltySanction
}

export type NextSanctionsSnapshot = {
  red: CornerNextSanctions
  blue: CornerNextSanctions
}

export function buildNextSanctions(score: ScoreState): NextSanctionsSnapshot {
  return {
    red: {
      general: nextSanctionOnLadder('GENERAL', score.generalDisciplinaryLadder.red),
      outOfBounds: nextSanctionOnLadder('OUT_OF_BOUNDS', score.outOfBoundsLadder.red),
      passivity: nextSanctionOnLadder('PASSIVITY', score.passivityLadder.red),
    },
    blue: {
      general: nextSanctionOnLadder('GENERAL', score.generalDisciplinaryLadder.blue),
      outOfBounds: nextSanctionOnLadder('OUT_OF_BOUNDS', score.outOfBoundsLadder.blue),
      passivity: nextSanctionOnLadder('PASSIVITY', score.passivityLadder.blue),
    },
  }
}
