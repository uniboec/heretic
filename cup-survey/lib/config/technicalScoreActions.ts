/** Technical actions that award points (Close Control / FSE judge console). */

export type TechnicalScoreActionId =
  | 'SPRAWL_CONTROL'
  | 'GUARD_CONTROL'
  | 'THROW_TRANSFER_NO_LIFT'
  | 'REVERSAL_CONTROL'
  | 'THROW_TWO_FEET_LIFT'
  | 'SIDE_CONTROL'
  | 'THROW_AMPLITUDE_CHEST'
  | 'FULL_CONTROL'
  | 'BACK_CONTROL'

export type TechnicalScoreActionDef = {
  id: TechnicalScoreActionId
  points: 1 | 2 | 3 | 4
  /** Compact label on the judge button */
  shortLabel: string
  /** Full label for history and tooltips */
  label: string
}

export const TECHNICAL_SCORE_ACTIONS: readonly TechnicalScoreActionDef[] = [
  {
    id: 'SPRAWL_CONTROL',
    points: 1,
    shortLabel: 'Spr',
    label: 'Спрол',
  },
  {
    id: 'GUARD_CONTROL',
    points: 1,
    shortLabel: 'Grd',
    label: 'Гард',
  },
  {
    id: 'THROW_TRANSFER_NO_LIFT',
    points: 1,
    shortLabel: 'Пер',
    label: 'Бросок',
  },
  {
    id: 'REVERSAL_CONTROL',
    points: 2,
    shortLabel: 'Rev',
    label: 'Реверс',
  },
  {
    id: 'THROW_TWO_FEET_LIFT',
    points: 2,
    shortLabel: 'Бр2',
    label: 'Бросок',
  },
  {
    id: 'SIDE_CONTROL',
    points: 3,
    shortLabel: 'Side',
    label: 'Сайд',
  },
  {
    id: 'THROW_AMPLITUDE_CHEST',
    points: 3,
    shortLabel: 'Бр3',
    label: 'Бросок',
  },
  {
    id: 'FULL_CONTROL',
    points: 4,
    shortLabel: 'Full',
    label: 'Фулл',
  },
  {
    id: 'BACK_CONTROL',
    points: 4,
    shortLabel: 'Back',
    label: 'Бэк',
  },
] as const

export const TECHNICAL_SCORE_ACTIONS_BY_POINTS: Record<1 | 2 | 3 | 4, TechnicalScoreActionDef[]> = {
  1: TECHNICAL_SCORE_ACTIONS.filter((action) => action.points === 1),
  2: TECHNICAL_SCORE_ACTIONS.filter((action) => action.points === 2),
  3: TECHNICAL_SCORE_ACTIONS.filter((action) => action.points === 3),
  4: TECHNICAL_SCORE_ACTIONS.filter((action) => action.points === 4),
}

const ACTION_BY_ID = new Map(
  TECHNICAL_SCORE_ACTIONS.map((action) => [action.id, action]),
)

export function getTechnicalScoreAction(
  actionId: TechnicalScoreActionId,
): TechnicalScoreActionDef {
  const action = ACTION_BY_ID.get(actionId)
  if (!action) {
    throw new Error(`Unknown technical score action: ${actionId}`)
  }
  return action
}

export function isTechnicalScoreActionId(value: unknown): value is TechnicalScoreActionId {
  return typeof value === 'string' && ACTION_BY_ID.has(value as TechnicalScoreActionId)
}
