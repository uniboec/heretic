import { resolveBoutDurationMinutes } from './boutDuration'
import { isTimeWeightedMode, type AutoMatAssignMode } from './autoMatMode'
import type { InternalBout } from './types'

export type MatTimingSettings = {
  boutBreakMinutes: number
  ageDivisionDurationOverrides: Record<string, number>
}

export function toMatTimingSettings(input: {
  boutBreakMinutes: number
  ageDivisionDurationOverrides: unknown
}): MatTimingSettings {
  const overrides =
    typeof input.ageDivisionDurationOverrides === 'object' &&
    input.ageDivisionDurationOverrides !== null &&
    !Array.isArray(input.ageDivisionDurationOverrides)
      ? (input.ageDivisionDurationOverrides as Record<string, number>)
      : {}
  return {
    boutBreakMinutes: input.boutBreakMinutes,
    ageDivisionDurationOverrides: overrides,
  }
}

export function createMatLoads(matCount: number): number[] {
  return Array.from({ length: matCount }, () => 0)
}

export function resolveBoutLoadMinutes(
  bout: Pick<InternalBout, 'categoryKey'>,
  settings: MatTimingSettings,
): number {
  return (
    resolveBoutDurationMinutes({
      categoryKey: bout.categoryKey,
      overrides: settings.ageDivisionDurationOverrides,
    }) + settings.boutBreakMinutes
  )
}

export function sumBoutLoads(
  bouts: Array<Pick<InternalBout, 'categoryKey'>>,
  settings: MatTimingSettings,
): number {
  return bouts.reduce((sum, bout) => sum + resolveBoutLoadMinutes(bout, settings), 0)
}

export function boutLoadWeight(
  bout: Pick<InternalBout, 'categoryKey'>,
  mode: AutoMatAssignMode,
  settings: MatTimingSettings,
): number {
  return isTimeWeightedMode(mode) ? resolveBoutLoadMinutes(bout, settings) : 1
}
