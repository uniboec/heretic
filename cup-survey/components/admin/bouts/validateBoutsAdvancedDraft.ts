import {
  isValidNotBeforeLocalTime,
  MAX_BREAK_AFTER_STAGE_MINUTES,
} from '@/lib/bouts/competitionStageSettings'
import {
  AGE_DIVISION_DURATION_MAX,
  AGE_DIVISION_DURATION_MIN,
} from '@/lib/bouts/settingsLimits'
import { isValidLocalTime } from '@/lib/bouts/startTimes'

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

function validateOptionalTime(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!HH_MM.test(trimmed) || !isValidLocalTime(trimmed)) {
    return 'Укажите время в формате HH:mm'
  }
  return undefined
}

function validateOptionalBreak(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_BREAK_AFTER_STAGE_MINUTES
  ) {
    return `От 0 до ${MAX_BREAK_AFTER_STAGE_MINUTES} мин`
  }
  return undefined
}

function validateOptionalDuration(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (
    !Number.isFinite(parsed) ||
    !Number.isInteger(parsed) ||
    parsed < AGE_DIVISION_DURATION_MIN ||
    parsed > AGE_DIVISION_DURATION_MAX
  ) {
    return `От ${AGE_DIVISION_DURATION_MIN} до ${AGE_DIVISION_DURATION_MAX} мин`
  }
  return undefined
}

export function validateMatOverridesDraft(draft: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [key, value] of Object.entries(draft)) {
    const error = validateOptionalTime(value)
    if (error) errors[key] = error
  }
  return errors
}

export interface StageDraft {
  breaks: Record<string, string>
  notBefore: Record<string, string>
}

export interface StageDraftErrors {
  breaks: Record<string, string>
  notBefore: Record<string, string>
}

export function validateStageDraft(draft: StageDraft): StageDraftErrors {
  const breaks: Record<string, string> = {}
  const notBefore: Record<string, string> = {}

  for (const [key, value] of Object.entries(draft.breaks)) {
    const error = validateOptionalBreak(value)
    if (error) breaks[key] = error
  }

  for (const [key, value] of Object.entries(draft.notBefore)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!isValidNotBeforeLocalTime(trimmed) || !isValidLocalTime(trimmed)) {
      notBefore[key] = 'Укажите время в формате HH:mm'
    }
  }

  return { breaks, notBefore }
}

export function validateDurationOverridesDraft(draft: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [key, value] of Object.entries(draft)) {
    const error = validateOptionalDuration(value)
    if (error) errors[key] = error
  }
  return errors
}

export function hasRecordErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0
}

export function hasStageDraftErrors(errors: StageDraftErrors): boolean {
  return hasRecordErrors(errors.breaks) || hasRecordErrors(errors.notBefore)
}
