import { describe, expect, it } from 'vitest'
import { startExtraRound } from '../startExtraRound'
import { baseExecution } from './matControlTestHelpers'

describe('startExtraRound', () => {
  it('resets extra clock accumulator after main', () => {
    const result = startExtraRound(
      baseExecution({
        boutPhase: 'live',
        currentPeriod: 'main',
        clockState: 'stopped',
        clockStartedAt: new Date('2026-09-30T10:03:00.000Z'),
        clockElapsedBeforeStartMs: 180_000,
        mainEndedAt: new Date('2026-09-30T10:03:00.000Z'),
      }),
    )

    expect(result.currentPeriod).toBe('extra')
    expect(result.clockElapsedBeforeStartMs).toBe(0)
    expect(result.clockStartedAt).toBeNull()
    expect(result.clockState).toBe('stopped')
    expect(result.periodCorrectionMode).toBe(false)
  })
})
