import type { InternalBout } from './types'

export type BoutScheduleOverride = {
  pinnedToEnd?: boolean
  manualOrder?: number
  /** Mat runtime queue: run this bout immediately after the anchor on the same mat. */
  queueAfterBoutId?: string
  /** Runtime cross-mat move: bout is scheduled on this mat instead of the published assignment. */
  assignedMatIndex?: number
}

export type BoutScheduleOverrides = Record<string, BoutScheduleOverride>

export type ProposedScheduleState = {
  overrides: BoutScheduleOverrides
  pinAllFinalsToEnd: boolean
  boutsByMat: Map<number, InternalBout[]>
}

export function parseBoutScheduleOverrides(raw: unknown): BoutScheduleOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: BoutScheduleOverrides = {}
  for (const [boutId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const entry = value as Record<string, unknown>
    const override: BoutScheduleOverride = {}
    if (entry.pinnedToEnd === true) override.pinnedToEnd = true
    if (
      typeof entry.manualOrder === 'number' &&
      Number.isInteger(entry.manualOrder) &&
      entry.manualOrder >= 0
    ) {
      override.manualOrder = entry.manualOrder
    }
    if (typeof entry.queueAfterBoutId === 'string' && entry.queueAfterBoutId.length > 0) {
      override.queueAfterBoutId = entry.queueAfterBoutId
    }
    if (
      typeof entry.assignedMatIndex === 'number' &&
      Number.isInteger(entry.assignedMatIndex) &&
      entry.assignedMatIndex >= 1
    ) {
      override.assignedMatIndex = entry.assignedMatIndex
    }
    if (Object.keys(override).length > 0) result[boutId] = override
  }
  return result
}

export function mergeScheduleOverrides(
  parts: BoutScheduleOverrides[],
): BoutScheduleOverrides {
  return Object.assign({}, ...parts)
}

export function pruneStaleScheduleOverrides(
  overrides: BoutScheduleOverrides,
  validBoutIds: Set<string>,
): BoutScheduleOverrides {
  const result: BoutScheduleOverrides = {}
  for (const [boutId, value] of Object.entries(overrides)) {
    if (!validBoutIds.has(boutId)) continue
    const queueAfterBoutId = value.queueAfterBoutId
    if (queueAfterBoutId && !validBoutIds.has(queueAfterBoutId)) {
      const { queueAfterBoutId: _removed, ...rest } = value
      if (Object.keys(rest).length === 0) continue
      result[boutId] = rest
      continue
    }
    result[boutId] = value
  }
  return result
}

export function hasManualOrder(overrides: BoutScheduleOverrides, boutId: string): boolean {
  return typeof overrides[boutId]?.manualOrder === 'number'
}

export function sanitizeManualOrderForMat(
  matBouts: InternalBout[],
  overrides: BoutScheduleOverrides,
): BoutScheduleOverrides {
  const withManual = matBouts.filter((b) => typeof overrides[b.id]?.manualOrder === 'number')
  if (withManual.length === 0) return overrides

  const n = matBouts.length
  if (withManual.length !== n) {
    const next = { ...overrides }
    for (const bout of matBouts) {
      if (next[bout.id]?.manualOrder !== undefined) {
        const { manualOrder: _removed, ...rest } = next[bout.id]!
        if (Object.keys(rest).length === 0) delete next[bout.id]
        else next[bout.id] = rest
      }
    }
    return next
  }

  const indices = withManual.map((b) => overrides[b.id]!.manualOrder!).sort((a, b) => a - b)
  const valid = indices.every((value, index) => value === index)
  if (!valid) {
    const next = { ...overrides }
    for (const bout of matBouts) {
      if (next[bout.id]?.manualOrder !== undefined) {
        const { manualOrder: _removed, ...rest } = next[bout.id]!
        if (Object.keys(rest).length === 0) delete next[bout.id]
        else next[bout.id] = rest
      }
    }
    return next
  }

  return overrides
}

export function clearManualOrderForMat(
  matBouts: InternalBout[],
  overrides: BoutScheduleOverrides,
): BoutScheduleOverrides {
  const next = { ...overrides }
  for (const bout of matBouts) {
    if (typeof next[bout.id]?.manualOrder !== 'number') continue
    const { manualOrder: _removed, ...rest } = next[bout.id]!
    if (Object.keys(rest).length === 0) delete next[bout.id]
    else next[bout.id] = rest
  }
  return next
}
