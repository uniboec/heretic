export type BoutScheduleWaves = Record<string, number>

export const EMPTY_BOUT_SCHEDULE_WAVES: BoutScheduleWaves = {}

export function sanitizeBoutScheduleWaves(raw: unknown): BoutScheduleWaves {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const result: BoutScheduleWaves = {}
  for (const [boutId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) continue
    result[boutId] = value
  }
  return result
}

export function getScheduleWave(
  boutId: string,
  waves: BoutScheduleWaves,
): number | undefined {
  return waves[boutId]
}

export function mergeBoutScheduleWaves(
  base: BoutScheduleWaves,
  patch: BoutScheduleWaves,
): BoutScheduleWaves {
  return { ...base, ...patch }
}

export function pruneBoutScheduleWaves(
  waves: BoutScheduleWaves,
  validBoutIds: Set<string>,
): BoutScheduleWaves {
  const result: BoutScheduleWaves = {}
  for (const [boutId, wave] of Object.entries(waves)) {
    if (validBoutIds.has(boutId)) {
      result[boutId] = wave
    }
  }
  return result
}
