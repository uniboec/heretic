import { describe, expect, it } from 'vitest'
import { entryIdForCorner } from '../assertBoutParticipantCorner'
import { computeAthleteDoctorTimers } from '../athleteDoctorVisit'
import { routeMatControlCommand } from '../matControlCommandRouter'
import type { BoutEventRecord, MatControlExecution, MatControlSessionRecord } from '../mat-control/types'

function baseExecution(overrides: Partial<MatControlExecution> = {}): MatControlExecution {
  return {
    boutId: 'bout-1',
    boutPhase: 'scheduled',
    clockState: 'idle',
    currentPeriod: 'main',
    attemptNumber: 1,
    liveRevision: 0,
    nextEventSequence: 0,
    clockElapsedBeforeStartMs: 0,
    clockStartedAt: null,
    officialStartedAt: null,
    actualStartAt: null,
    mainEndedAt: null,
    extraEndedAt: null,
    activityCorrectionMode: false,
    periodCorrectionMode: false,
    liveSnapshot: { cornersSwapped: true },
    ...overrides,
  }
}

const session: MatControlSessionRecord = {
  matIndex: 1,
  holderToken: 'holder',
  holderExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
  activeBoutId: null,
}

describe('mat control athlete doctor', () => {
  it('starts doctor visit for swapped-corner UI column', () => {
    const participants = {
      redEntryId: 'side-a',
      blueEntryId: 'side-b',
      cornersSwapped: true,
    }
    const now = new Date('2026-01-01T12:00:00.000Z')

    const result = routeMatControlCommand({
      execution: baseExecution(),
      session,
      participants,
      events: [],
      now,
      envelope: {
        operationId: '00000000-0000-4000-8000-000000000001',
        holderToken: 'holder',
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
      },
      intent: 'ATHLETE_DOCTOR_START',
      payload: {
        entryId: entryIdForCorner('red', participants),
        corner: 'red',
      },
    })

    expect(result.createdEvents).toHaveLength(1)
    expect(result.createdEvents[0]?.eventType).toBe('ATHLETE_DOCTOR_START')
    expect(result.createdEvents[0]?.entryId).toBe('side-b')

    const timers = computeAthleteDoctorTimers({
      events: result.createdEvents as BoutEventRecord[],
      participants,
      attemptNumber: 1,
      now: new Date('2026-01-01T12:00:05.000Z'),
    })

    expect(timers.red?.isActive).toBe(true)
    expect(timers.red?.totalMs).toBe(5_000)
  })
})
