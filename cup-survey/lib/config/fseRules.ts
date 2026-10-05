/** FSE TC/CC victory methods and penalty ladder rules (Правила ФСЕ 1.0.10). */

export type VictoryMethod =
  | 'POINTS'
  | 'CLEAR_ADVANTAGE'
  | 'SUBMISSION'
  | 'CHOKE'
  | 'DISQUALIFICATION'
  | 'NO_SHOW'
  | 'INJURY'
  | 'FORFEIT'
  | 'TECHNICAL_SUPERIORITY'
  | 'KNOCKOUT'
  | 'TECHNICAL_KNOCKOUT'

/** Подтип болевого приёма — обязателен при victoryMethod = SUBMISSION. */
export type SubmissionSubtype = 'ARM' | 'LEG' | 'OTHER'

/** REMARK сохранён для исторических событий; в актуальной лестнице не используется. */
export type PenaltySanction =
  | 'REMARK'
  | 'WARNING_1'
  | 'WARNING_2'
  | 'WARNING_3'
  | 'DISQUALIFICATION'

export type PenaltyLadder = 'GENERAL' | 'OUT_OF_BOUNDS' | 'PASSIVITY'

export type DecisionReason =
  | 'TOTAL_SCORE'
  | 'HIGHER_TECHNICAL_SCORE'
  | 'FEWER_PENALTIES'
  | 'LAST_TECHNICAL_SCORE'
  | 'EXTRA_ROUND_REQUIRED'
  | 'EXTRA_ACTIVITY'
  | 'CLEAR_ADVANTAGE'
  | 'SUBMISSION'
  | 'CHOKE'
  | 'DISQUALIFICATION'
  | 'NO_SHOW'
  | 'INJURY'
  | 'FORFEIT'

/** О.Т.К. в TC/CC — отказ от продолжения; UI label «О.Т.К.». */
export const FORFEIT_VICTORY_METHOD: VictoryMethod = 'FORFEIT'

export const GENERAL_DISCIPLINARY_LADDER: readonly PenaltySanction[] = [
  'WARNING_1',
  'WARNING_2',
  'WARNING_3',
  'DISQUALIFICATION',
] as const

export const OUT_OF_BOUNDS_LADDER: readonly PenaltySanction[] = [
  'WARNING_1',
  'WARNING_2',
  'WARNING_3',
  'DISQUALIFICATION',
] as const

export const PASSIVITY_LADDER: readonly PenaltySanction[] = [
  'WARNING_1',
  'WARNING_2',
  'WARNING_3',
  'DISQUALIFICATION',
] as const

const AWARDED_POINTS_BY_SANCTION: Record<PenaltySanction, 0 | 1 | 2 | 3> = {
  REMARK: 0,
  WARNING_1: 1,
  WARNING_2: 2,
  WARNING_3: 3,
  DISQUALIFICATION: 0,
}

export function getPenaltyLadderSteps(ladder: PenaltyLadder): readonly PenaltySanction[] {
  switch (ladder) {
    case 'GENERAL':
      return GENERAL_DISCIPLINARY_LADDER
    case 'OUT_OF_BOUNDS':
      return OUT_OF_BOUNDS_LADDER
    case 'PASSIVITY':
      return PASSIVITY_LADDER
  }
}

export function awardedPointsForSanction(sanction: PenaltySanction): 0 | 1 | 2 | 3 {
  return AWARDED_POINTS_BY_SANCTION[sanction]
}

export function nextSanctionOnLadder(
  ladder: PenaltyLadder,
  currentSanction: PenaltySanction | null,
): PenaltySanction {
  const steps = getPenaltyLadderSteps(ladder)
  if (currentSanction == null || currentSanction === 'REMARK') {
    return steps[0]!
  }
  const index = steps.indexOf(currentSanction)
  if (index < 0 || index >= steps.length - 1) {
    return 'DISQUALIFICATION'
  }
  return steps[index + 1]!
}

export function countsTowardPeriodPenaltyCount(sanction: PenaltySanction): boolean {
  return sanction !== 'DISQUALIFICATION'
}

const VICTORY_METHOD_LABELS: Record<VictoryMethod, string> = {
  POINTS: 'П.Б.',
  CLEAR_ADVANTAGE: 'Я.П.',
  SUBMISSION: 'Б.П.',
  CHOKE: 'У.П.',
  DISQUALIFICATION: 'Д.С.К.',
  NO_SHOW: 'Н.Я.',
  INJURY: 'Н.П.Б.',
  FORFEIT: 'О.Т.К.',
  TECHNICAL_SUPERIORITY: 'Т.П.',
  KNOCKOUT: 'Н.К.',
  TECHNICAL_KNOCKOUT: 'Т.Н.К.',
}

const SUBMISSION_SUBTYPE_LABELS: Record<SubmissionSubtype, string> = {
  ARM: 'рука',
  LEG: 'нога',
  OTHER: 'другое',
}

const SUBMISSION_SUBTYPE_FULL_LABELS: Record<SubmissionSubtype, string> = {
  ARM: 'на руку',
  LEG: 'на ногу',
  OTHER: '',
}

const VICTORY_METHOD_FULL_LABELS: Record<VictoryMethod, string> = {
  POINTS: 'По очкам',
  CLEAR_ADVANTAGE: 'Явное преимущество',
  SUBMISSION: 'Болевой приём',
  CHOKE: 'Удушающий приём',
  DISQUALIFICATION: 'Дисквалификация',
  NO_SHOW: 'Неявка',
  INJURY: 'Невозможность продолжать',
  FORFEIT: 'Отказ от продолжения',
  TECHNICAL_SUPERIORITY: 'Техническое превосходство',
  KNOCKOUT: 'Нокаут',
  TECHNICAL_KNOCKOUT: 'Технический нокаут',
}

export function formatVictoryMethod(
  method: VictoryMethod,
  options?: { submissionSubtype?: SubmissionSubtype; operatorFacing?: boolean },
): string {
  if (method === 'FORFEIT' && options?.operatorFacing) {
    return 'О.Т.К. — отказ от продолжения'
  }
  const base = VICTORY_METHOD_LABELS[method] ?? method
  if (method === 'SUBMISSION' && options?.submissionSubtype) {
    const subtype = SUBMISSION_SUBTYPE_LABELS[options.submissionSubtype]
    return `${base} (${subtype})`
  }
  return base
}

export function formatVictoryMethodFull(
  method: VictoryMethod,
  options?: { submissionSubtype?: SubmissionSubtype },
): string {
  const base = VICTORY_METHOD_FULL_LABELS[method] ?? method
  if (method === 'SUBMISSION' && options?.submissionSubtype) {
    const subtype = SUBMISSION_SUBTYPE_FULL_LABELS[options.submissionSubtype]
    return subtype ? `${base} ${subtype}` : base
  }
  return base
}
