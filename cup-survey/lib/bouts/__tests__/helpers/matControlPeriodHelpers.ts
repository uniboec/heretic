import { getNormalizedBoutsPageSettings } from '../../service'
import { resolveBoutDurationMinutes } from '../../boutDuration'
import type { ControlIntent } from '../../mat-control/types'

export async function resolvePeriodDurationMsForCategory(categoryKey: string): Promise<number> {
  const settings = await getNormalizedBoutsPageSettings()
  return (
    resolveBoutDurationMinutes({
      categoryKey,
      overrides: settings.ageDivisionDurationOverrides,
    }) * 60_000
  )
}

export async function fastForwardCurrentPeriod(input: {
  runCommand: (
    operationId: string,
    intent: ControlIntent,
    payload?: Record<string, unknown>,
  ) => Promise<unknown>
  periodDurationMs: number
  operationIdPrefix: string
}) {
  await input.runCommand(`${input.operationIdPrefix}-stop`, 'CLOCK_STOP')
  await input.runCommand(`${input.operationIdPrefix}-elapsed`, 'CLOCK_ADJUST', {
    deltaMs: -input.periodDurationMs,
  })
}
