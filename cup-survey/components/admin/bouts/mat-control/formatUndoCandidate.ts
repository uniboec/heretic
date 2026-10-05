import type { UndoCandidate, UndoCandidateSemantic } from '@/lib/bouts/getUndoCandidate'
import type { Corner } from '@/lib/bouts/mat-control/types'

function cornerLabel(corner: Corner): string {
  return corner === 'red' ? 'Красному' : 'Синему'
}

function formatSemantic(semantic: UndoCandidateSemantic): { historyLabel: string; buttonLabel: string } {
  switch (semantic.kind) {
    case 'TECHNICAL_SCORE':
      return {
        historyLabel: semantic.actionLabel
          ? `${cornerLabel(semantic.corner)} +${semantic.points} · ${semantic.actionLabel}`
          : `${cornerLabel(semantic.corner)} +${semantic.points} балла`,
        buttonLabel: semantic.actionLabel
          ? `Отменить +${semantic.points} ${semantic.actionLabel}`
          : `Отменить +${semantic.points}`,
      }
    case 'PENALTY':
      if (semantic.sanction === 'DISQUALIFICATION') {
        return {
          historyLabel: `Дисквалификация · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
          buttonLabel: 'Отменить дисквалификацию',
        }
      }
      return {
        historyLabel: `Нарушение · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить нарушение',
      }
    case 'ADJUDICATION':
      return {
        historyLabel: `Согласование · ${cornerLabel(semantic.corner)} +${semantic.points}`,
        buttonLabel: `Отменить +${semantic.points}`,
      }
    case 'CORNER_SWAP':
      return { historyLabel: 'Смена углов', buttonLabel: 'Отменить смену углов' }
    case 'FIRST_CALL':
      return {
        historyLabel: `Первичный вызов · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить вызов',
      }
    case 'SECONDARY_CALL':
      return {
        historyLabel: `Повторный вызов · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить повторный вызов',
      }
    case 'ATHLETE_WAIT_START':
      return {
        historyLabel: `Ожидание · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить ожидание',
      }
    case 'ATHLETE_WAIT_END':
      return {
        historyLabel: `Пауза ожидания · ${semantic.corner === 'red' ? 'красный' : 'синий'} (${Math.round(semantic.waitedMs / 1000)} сек)`,
        buttonLabel: 'Отменить паузу ожидания',
      }
    case 'ATHLETE_DOCTOR_START':
      return {
        historyLabel: `У врача · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить отправку к врачу',
      }
    case 'ATHLETE_DOCTOR_END':
      return {
        historyLabel: `Возврат от врача · ${semantic.corner === 'red' ? 'красный' : 'синий'} (${Math.round(semantic.totalMs / 1000)} сек)`,
        buttonLabel: 'Отменить возврат от врача',
      }
    case 'ATHLETE_EQUIPMENT_START':
      return {
        historyLabel: `Исправление экипировки · ${semantic.corner === 'red' ? 'красный' : 'синий'}`,
        buttonLabel: 'Отменить исправление экипировки',
      }
    case 'ATHLETE_EQUIPMENT_END':
      return {
        historyLabel: `Пауза экипировки · ${semantic.corner === 'red' ? 'красный' : 'синий'} (${Math.round(semantic.totalMs / 1000)} сек)`,
        buttonLabel: 'Отменить паузу экипировки',
      }
    case 'CLOCK_ADJUST':
      return {
        historyLabel: `Коррекция времени ${semantic.deltaMs >= 0 ? '+' : ''}${Math.round(semantic.deltaMs / 1000)} сек`,
        buttonLabel: 'Отменить коррекцию времени',
      }
    case 'COMPOUND':
      return {
        historyLabel: 'Последнее действие',
        buttonLabel: 'Отменить последнее',
      }
  }
}

export function formatUndoCandidate(candidate: UndoCandidate): {
  historyLabel: string
  buttonLabel: string
} {
  return formatSemantic(candidate.semantic)
}
