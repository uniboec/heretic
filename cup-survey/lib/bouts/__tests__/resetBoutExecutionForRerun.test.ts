import { describe, expect, it } from 'vitest'
import { resetBoutExecutionForRerun } from '../resetBoutExecutionForRerun'
import { baseExecution } from './matControlTestHelpers'

describe('resetBoutExecutionForRerun', () => {
  it('clears timing fields and resets bout to scheduled', () => {
    const reset = resetBoutExecutionForRerun(
      baseExecution({
        boutPhase: 'confirmed',
        clockState: 'stopped',
        officialStartedAt: new Date(),
        officialEndedAt: new Date(),
        mainEndedAt: new Date(),
        actualStartAt: new Date(),
        actualEndAt: new Date(),
        clockStartedAt: new Date(),
        clockElapsedBeforeStartMs: 42_000,
        liveRevision: 7,
        attemptNumber: 2,
        liveSnapshot: { swapped: true },
      }),
    )

    expect(reset.boutPhase).toBe('scheduled')
    expect(reset.clockState).toBe('idle')
    expect(reset.officialStartedAt).toBeNull()
    expect(reset.officialEndedAt).toBeNull()
    expect(reset.mainEndedAt).toBeNull()
    expect(reset.actualStartAt).toBeNull()
    expect(reset.actualEndAt).toBeNull()
    expect(reset.clockStartedAt).toBeNull()
    expect(reset.clockElapsedBeforeStartMs).toBe(0)
    expect(reset.liveSnapshot).toBeNull()
    expect(reset.attemptNumber).toBe(3)
    expect(reset.liveRevision).toBe(8)
  })
})
