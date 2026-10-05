import { formatTechnicalScoreActionFromPayload } from './formatTechnicalScoreAction'
import type { BoutEventRecord, BoutEventType, Corner, PenaltyEventPayload } from '../mat-control/types'

function cornerLabel(corner: Corner | null): string {
  if (corner === 'red') return 'красный угол'
  if (corner === 'blue') return 'синий угол'
  return 'угол'
}

function cornerShort(corner: Corner | null): string {
  if (corner === 'red') return 'Красному'
  if (corner === 'blue') return 'Синему'
  return 'Углу'
}

const EVENT_FORMATTERS = {
  TECHNICAL_SCORE: (event: BoutEventRecord) => {
    const actionLabel = formatTechnicalScoreActionFromPayload(event.payload)
    const points = event.points ?? 0
    if (actionLabel) {
      return `${cornerShort(event.cornerAtEvent)} +${points} · ${actionLabel}`
    }
    return `${cornerShort(event.cornerAtEvent)} +${points} балла`
  },
  PENALTY: (event: BoutEventRecord) => {
    const payload = event.payload as PenaltyEventPayload | null
    const sanction = payload?.sanction ?? 'REMARK'
    const points = event.points ?? 0
    if (points > 0) {
      return `Предупреждение ${cornerLabel(event.cornerAtEvent)} · ${cornerShort(event.cornerAtEvent === 'red' ? 'blue' : 'red')} +${points}`
    }
    if (sanction === 'DISQUALIFICATION') {
      return `Дисквалификация · ${cornerLabel(event.cornerAtEvent)}`
    }
    return `Нарушение · ${cornerLabel(event.cornerAtEvent)}`
  },
  BOUT_STOPPAGE: () => 'Поединок остановлен',
  PASSIVITY_START: (event: BoutEventRecord) => `Пассивность · ${cornerLabel(event.cornerAtEvent)}`,
  PASSIVITY_END: (event: BoutEventRecord) => `Активность · ${cornerLabel(event.cornerAtEvent)}`,
  FIRST_CALL: (event: BoutEventRecord) => `Первичный вызов: ${cornerLabel(event.cornerAtEvent)}`,
  SECONDARY_CALL: (event: BoutEventRecord) => `Повторный вызов: ${cornerLabel(event.cornerAtEvent)}`,
  ATHLETE_WAIT_START: (event: BoutEventRecord) => `Ожидание: ${cornerLabel(event.cornerAtEvent)}`,
  ATHLETE_DOCTOR_START: (event: BoutEventRecord) => `У врача: ${cornerLabel(event.cornerAtEvent)}`,
  ATHLETE_DOCTOR_END: (event: BoutEventRecord) => {
    const payload = event.payload as { accumulatedMs?: number } | null
    const waitedSec = Math.round((payload?.accumulatedMs ?? 0) / 1000)
    return `Возврат от врача: ${cornerLabel(event.cornerAtEvent)} (${waitedSec} сек)`
  },
  ATHLETE_EQUIPMENT_START: (event: BoutEventRecord) =>
    `Исправление экипировки: ${cornerLabel(event.cornerAtEvent)}`,
  ATHLETE_EQUIPMENT_END: (event: BoutEventRecord) => {
    const payload = event.payload as { accumulatedMs?: number } | null
    const waitedSec = Math.round((payload?.accumulatedMs ?? 0) / 1000)
    return `Пауза экипировки: ${cornerLabel(event.cornerAtEvent)} (${waitedSec} сек)`
  },
  ATHLETE_WAIT_END: (event: BoutEventRecord) => {
    const payload = event.payload as { accumulatedMs?: number; penaltyStepsApplied?: number } | null
    const waitedSec = Math.round((payload?.accumulatedMs ?? 0) / 1000)
    const penalties = payload?.penaltyStepsApplied ?? 0
    const suffix = penalties > 0 ? ` · ${penalties} штраф(а)` : ''
    return `Пауза ожидания: ${cornerLabel(event.cornerAtEvent)} (${waitedSec} сек${suffix})`
  },
  PERIOD_ENDED: () => 'Период завершён',
  CLOCK_START: () => 'Время запущено',
  CLOCK_STOP: () => 'Время остановлено',
  CLOCK_ADJUST: (event: BoutEventRecord) => {
    const payload = event.payload as { deltaMs?: number } | null
    const delta = payload?.deltaMs ?? 0
    const sign = delta >= 0 ? '+' : '−'
    return `Коррекция времени ${sign}${Math.abs(Math.round(delta / 1000))} сек`
  },
  CORNER_SWAP: () => 'Углы сменены',
  ADJUDICATION: (event: BoutEventRecord) =>
    `Согласование оценки · ${cornerShort(event.cornerAtEvent)} +${event.points ?? 0}`,
  EXTRA_ACTIVITY_DECISION: (event: BoutEventRecord) => {
    const corner = event.cornerAtEvent ?? (event.payload as { winnerCorner?: Corner } | null)?.winnerCorner
    return corner ? `Активнее · ${cornerShort(corner)}` : 'Решение по активности'
  },
  STOPPAGE_CANCELLED: () => 'Остановка отменена',
  RESULT_CONFIRMED: () => 'Результат подтверждён',
  UNDO: () => 'Отмена действия',
} satisfies Record<BoutEventType, (event: BoutEventRecord) => string>

export function formatMatControlEvent(event: BoutEventRecord): string {
  const formatter = EVENT_FORMATTERS[event.eventType]
  const label = formatter?.(event) ?? `Событие: ${event.eventType}`
  return event.undoneAt ? `${label} (отменено)` : label
}
