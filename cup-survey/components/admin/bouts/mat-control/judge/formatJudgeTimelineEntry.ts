import { formatMatControlEvent } from '@/lib/bouts/presentation/formatMatControlEvent'
import { formatTechnicalScoreActionFromPayload } from '@/lib/bouts/presentation/formatTechnicalScoreAction'
import type { PenaltyLadder } from '@/lib/config/fseRules'
import type {
  BoutEventRecord,
  BoutEventType,
  Corner,
  PenaltyEventPayload,
} from '@/lib/bouts/mat-control/types'

import { formatBoutElapsedTime } from './judgeUtils'

export type JudgeTimelineEntryKind = 'score' | 'penalty' | 'neutral'

export type JudgeTimelineEntry = {
  id: string
  kind: JudgeTimelineEntryKind
  corner: Corner | null
  headline: string
  subtitle: string
  boutTime: string
  title: string
}

const LADDER_LABELS: Record<PenaltyLadder, string> = {
  GENERAL: 'Нарушение',
  OUT_OF_BOUNDS: 'Ковёр',
  PASSIVITY: 'Пассивность',
}

const NEUTRAL_EVENT_LABELS: Partial<Record<BoutEventType, { headline: string; subtitle: string }>> =
  {
    PASSIVITY_START: { headline: 'П', subtitle: 'Пассивность' },
    PASSIVITY_END: { headline: 'А', subtitle: 'Активность' },
    BOUT_STOPPAGE: { headline: 'С', subtitle: 'Стоп' },
    CLOCK_STOP: { headline: 'С', subtitle: 'Время' },
    STOPPAGE_CANCELLED: { headline: 'Г', subtitle: 'Продолжение' },
    PERIOD_ENDED: { headline: 'К', subtitle: 'Период' },
    EXTRA_ACTIVITY_DECISION: { headline: 'А', subtitle: 'Активнее' },
    FIRST_CALL: { headline: '1', subtitle: 'Вызов' },
    SECONDARY_CALL: { headline: '2', subtitle: 'Вызов' },
    ATHLETE_WAIT_START: { headline: 'О', subtitle: 'Ожидание' },
    ATHLETE_WAIT_END: { headline: 'О', subtitle: 'Ожидание' },
    ATHLETE_DOCTOR_START: { headline: 'В', subtitle: 'У врача' },
    ATHLETE_DOCTOR_END: { headline: 'В', subtitle: 'От врача' },
    ATHLETE_EQUIPMENT_START: { headline: 'Э', subtitle: 'Экипировка' },
    ATHLETE_EQUIPMENT_END: { headline: 'Э', subtitle: 'Экипировка' },
    CORNER_SWAP: { headline: 'У', subtitle: 'Смена углов' },
    RESULT_CONFIRMED: { headline: 'И', subtitle: 'Итог' },
  }

function penaltyJournalHeadline(sanction: PenaltyEventPayload['sanction']): string {
  switch (sanction) {
    case 'REMARK':
      return 'З'
    case 'WARNING_1':
      return '1'
    case 'WARNING_2':
      return '2'
    case 'WARNING_3':
      return '3'
    case 'DISQUALIFICATION':
      return 'Д'
    default:
      return 'Н'
  }
}

function penaltyLadderLabel(payload: PenaltyEventPayload | null): string {
  const ladder = payload?.ladder ?? 'GENERAL'
  return LADDER_LABELS[ladder]
}

function neutralEventLabels(event: BoutEventRecord): { headline: string; subtitle: string } {
  const preset = NEUTRAL_EVENT_LABELS[event.eventType]
  if (preset) return preset

  const label = formatMatControlEvent(event)
  if (label.length <= 14) {
    return { headline: '•', subtitle: label }
  }
  return { headline: '•', subtitle: `${label.slice(0, 12)}…` }
}

function withTitle(
  event: BoutEventRecord,
  entry: Omit<JudgeTimelineEntry, 'title'>,
): JudgeTimelineEntry {
  return { ...entry, title: formatMatControlEvent(event) }
}

export function formatJudgeTimelineEntry(event: BoutEventRecord): JudgeTimelineEntry {
  const boutTime = formatBoutElapsedTime(event.boutElapsedMs)

  if (event.eventType === 'TECHNICAL_SCORE') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    const actionLabel = formatTechnicalScoreActionFromPayload(event.payload)
    return withTitle(event, {
      id: event.id,
      kind: 'score',
      corner,
      headline: `+${points}`,
      subtitle: actionLabel ?? 'Баллы',
      boutTime,
    })
  }

  if (event.eventType === 'PENALTY') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    const payload = event.payload as PenaltyEventPayload | null
    const ladderLabel = penaltyLadderLabel(payload)

    if (points > 0) {
      const opponent = corner === 'red' ? 'blue' : 'red'
      return withTitle(event, {
        id: event.id,
        kind: 'score',
        corner: opponent,
        headline: `+${points}`,
        subtitle: ladderLabel,
        boutTime,
      })
    }

    if (payload?.sanction === 'DISQUALIFICATION') {
      return withTitle(event, {
        id: event.id,
        kind: 'penalty',
        corner,
        headline: 'Д',
        subtitle: ladderLabel,
        boutTime,
      })
    }

    const sanction = payload?.sanction ?? 'REMARK'
    return withTitle(event, {
      id: event.id,
      kind: 'penalty',
      corner,
      headline: penaltyJournalHeadline(sanction),
      subtitle: ladderLabel,
      boutTime,
    })
  }

  if (event.eventType === 'ADJUDICATION') {
    const corner = event.cornerAtEvent
    const points = event.points ?? 0
    return withTitle(event, {
      id: event.id,
      kind: 'score',
      corner,
      headline: `+${points}`,
      subtitle: 'Оценка',
      boutTime,
    })
  }

  const labels = neutralEventLabels(event)
  return withTitle(event, {
    id: event.id,
    kind: event.cornerAtEvent ? 'penalty' : 'neutral',
    corner: event.cornerAtEvent,
    headline: labels.headline,
    subtitle: labels.subtitle,
    boutTime,
  })
}

export function getJudgeTimelineEvents(
  events: BoutEventRecord[],
  attemptNumber: number,
): BoutEventRecord[] {
  return events.filter((event) => {
    if (event.undoneAt) return false
    if (event.attemptNumber !== attemptNumber) return false
    if (event.eventType === 'UNDO') return false
    if (event.eventType === 'CLOCK_START') return false
    return true
  })
}
