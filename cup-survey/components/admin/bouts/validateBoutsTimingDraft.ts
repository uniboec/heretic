import {
  BOUT_BREAK_MINUTES_MAX,
  BOUT_BREAK_MINUTES_MIN,
} from '@/lib/bouts/settingsLimits'
import { isValidLocalTime } from '@/lib/bouts/startTimes'

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

export interface TimingDraft {
  boutsStartTime: string
  boutBreakMinutes: number
}

export function validateTimingDraft(draft: TimingDraft): {
  boutsStartTime?: string
  boutBreakMinutes?: string
} {
  const errors: { boutsStartTime?: string; boutBreakMinutes?: string } = {}

  if (!HH_MM.test(draft.boutsStartTime) || !isValidLocalTime(draft.boutsStartTime)) {
    errors.boutsStartTime = 'Укажите время в формате HH:mm'
  }

  if (
    !Number.isFinite(draft.boutBreakMinutes) ||
    !Number.isInteger(draft.boutBreakMinutes) ||
    draft.boutBreakMinutes < BOUT_BREAK_MINUTES_MIN ||
    draft.boutBreakMinutes > BOUT_BREAK_MINUTES_MAX
  ) {
    errors.boutBreakMinutes = `От ${BOUT_BREAK_MINUTES_MIN} до ${BOUT_BREAK_MINUTES_MAX} мин`
  }

  return errors
}
