import { formatBoutLabel } from './labels'
import { resolveBoutIdForBracketMatch } from './scheduleHint'

const STALE_INTERNAL_BOUT_LABEL = /^Бой \d+$/
const STALE_INTERNAL_BOUT_BADGE_LABEL = /^Бой №\d+$/

export function isStaleInternalBoutLabel(label: string): boolean {
  return STALE_INTERNAL_BOUT_LABEL.test(label)
}

export function isStaleInternalBoutBadgeLabel(label: string): boolean {
  return STALE_INTERNAL_BOUT_BADGE_LABEL.test(label)
}

export function resolveBracketMatchLabel(input: {
  categoryKey: string
  matchId: string
  label?: string
  matchNumber?: number | null
  slot?: number
  scheduleDisplayByBoutId?: Map<string, string>
}): string {
  const boutId = resolveBoutIdForBracketMatch(input.categoryKey, input.matchId)
  const displayNumber = input.scheduleDisplayByBoutId?.get(boutId)
  const label = input.label?.trim()

  if (displayNumber && (!label || isStaleInternalBoutLabel(label))) {
    return `Бой ${displayNumber}`
  }

  if (label && !isStaleInternalBoutLabel(label)) {
    return label
  }

  if (input.matchNumber != null) {
    return formatBoutLabel(input.matchNumber)
  }

  return `Бой ${input.slot ?? '—'}`
}

export function resolveBracketMatchBadgeLabel(input: {
  categoryKey: string
  matchId: string
  label?: string
  matchNumber?: number | null
  scheduleDisplayByBoutId?: Map<string, string>
}): string | null {
  const boutId = resolveBoutIdForBracketMatch(input.categoryKey, input.matchId)
  const displayNumber = input.scheduleDisplayByBoutId?.get(boutId)
  const label = input.label?.trim()

  if (displayNumber && (!label || isStaleInternalBoutBadgeLabel(label) || isStaleInternalBoutLabel(label))) {
    return `Бой №${displayNumber}`
  }

  if (label && !isStaleInternalBoutBadgeLabel(label) && !isStaleInternalBoutLabel(label)) {
    return label
  }

  if (input.matchNumber != null) {
    return `Бой №${input.matchNumber}`
  }

  return null
}
