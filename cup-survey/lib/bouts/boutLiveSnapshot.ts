import type { AgeDivisionDurationOverrides } from './boutDuration'
import { resolveBoutDurationMinutes } from './boutDuration'
import type { DecisionReason } from '../config/fseRules'
import type { BoutPeriod } from './mat-control/types'

export type BoutPeriodCount = 1 | 2

export type BoutLiveSnapshot = {
  cornersSwapped?: boolean
  periodDurationMs?: {
    main?: number
    extra?: number
  }
  periodCount?: BoutPeriodCount
}

export function mergeLiveSnapshot(
  liveSnapshot: unknown,
  patch: Partial<BoutLiveSnapshot>,
): BoutLiveSnapshot {
  const current = parseLiveSnapshot(liveSnapshot)
  const next: BoutLiveSnapshot = { ...current }

  if (patch.cornersSwapped !== undefined) {
    next.cornersSwapped = patch.cornersSwapped
  }

  if (patch.periodDurationMs) {
    next.periodDurationMs = {
      ...current.periodDurationMs,
      ...patch.periodDurationMs,
    }
  }

  if (patch.periodCount !== undefined) {
    next.periodCount = patch.periodCount
  }

  return next
}

export function parseLiveSnapshot(liveSnapshot: unknown): BoutLiveSnapshot {
  if (!liveSnapshot || typeof liveSnapshot !== 'object' || Array.isArray(liveSnapshot)) {
    return {}
  }
  const raw = liveSnapshot as BoutLiveSnapshot
  const periodDurationMs =
    raw.periodDurationMs && typeof raw.periodDurationMs === 'object'
      ? {
          main:
            typeof raw.periodDurationMs.main === 'number' &&
            Number.isFinite(raw.periodDurationMs.main)
              ? raw.periodDurationMs.main
              : undefined,
          extra:
            typeof raw.periodDurationMs.extra === 'number' &&
            Number.isFinite(raw.periodDurationMs.extra)
              ? raw.periodDurationMs.extra
              : undefined,
        }
      : undefined

  const periodCount = raw.periodCount === 1 || raw.periodCount === 2 ? raw.periodCount : undefined

  return {
    cornersSwapped: raw.cornersSwapped === true ? true : undefined,
    periodDurationMs,
    periodCount,
  }
}

export function resolvePeriodCount(liveSnapshot: unknown): BoutPeriodCount {
  const snapshot = parseLiveSnapshot(liveSnapshot)
  return snapshot.periodCount ?? 2
}

export function resolveDefaultPeriodDurationMs(input: {
  categoryKey: string
  overrides: AgeDivisionDurationOverrides
}): number {
  return resolveBoutDurationMinutes(input) * 60_000
}

export function resolvePeriodDurationMs(input: {
  liveSnapshot: unknown
  period: BoutPeriod
  categoryKey: string
  overrides: AgeDivisionDurationOverrides
}): number {
  const snapshot = parseLiveSnapshot(input.liveSnapshot)
  const defaultMs = resolveDefaultPeriodDurationMs({
    categoryKey: input.categoryKey,
    overrides: input.overrides,
  })

  if (input.period === 'main') {
    return snapshot.periodDurationMs?.main ?? defaultMs
  }

  return snapshot.periodDurationMs?.extra ?? snapshot.periodDurationMs?.main ?? defaultMs
}

export function mapDecisionReasonForPeriodCount(input: {
  reason: DecisionReason
  period: BoutPeriod
  liveSnapshot: unknown
}): DecisionReason {
  if (
    input.period === 'main' &&
    input.reason === 'EXTRA_ROUND_REQUIRED' &&
    resolvePeriodCount(input.liveSnapshot) === 1
  ) {
    return 'EXTRA_ACTIVITY'
  }
  return input.reason
}
