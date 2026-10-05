import { describe, expect, it } from 'vitest'
import { entryIdForCorner } from '../assertBoutParticipantCorner'
import { ATHLETE_EQUIPMENT_TIMEOUT_MS, computeAthleteEquipmentTimers } from '../athleteEquipmentCorrection'
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

const participants = {
  redEntryId: 'side-a',
  blueEntryId: 'side-b',
  cornersSwapped: true,
}

function equipmentEvent(
  eventType: 'ATHLETE_EQUIPMENT_START' | 'ATHLETE_EQUIPMENT_END',
  input: {
    entryId: string
    corner: 'red' | 'blue'
    createdAt: Date
    accumulatedMs?: number
    sessionMs?: number
  },
): BoutEventRecord {
  const payload =
    eventType === 'ATHLETE_EQUIPMENT_START'
      ? { accumulatedMs: input.accumulatedMs ?? 0 }
      : {
          accumulatedMs: input.accumulatedMs ?? 0,
          sessionMs: input.sessionMs ?? 0,
        }

  return {
    id: `${eventType}-${input.createdAt.getTime()}`,
    boutId: 'bout-1',
    clientEventId: `${eventType}-${input.createdAt.getTime()}`,
    sequence: 1,
    eventType,
    entryId: input.entryId,
    cornerAtEvent: input.corner,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload,
    undoneAt: null,
    createdAt: input.createdAt,
  }
}

describe('mat control athlete equipment', () => {
  it('starts equipment correction for swapped-corner UI column', () => {
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
      intent: 'ATHLETE_EQUIPMENT_START',
      payload: {
        entryId: entryIdForCorner('red', participants),
        corner: 'red',
      },
    })

    expect(result.createdEvents).toHaveLength(1)
    expect(result.createdEvents[0]?.eventType).toBe('ATHLETE_EQUIPMENT_START')
    expect(result.createdEvents[0]?.entryId).toBe('side-b')

    const timers = computeAthleteEquipmentTimers({
      events: result.createdEvents as BoutEventRecord[],
      participants,
      attemptNumber: 1,
      now: new Date('2026-01-01T12:00:05.000Z'),
    })

    expect(timers.red?.isActive).toBe(true)
    expect(timers.red?.totalMs).toBe(5_000)
  })

  it('records disqualification stoppage after two minutes', () => {
    const t0 = new Date('2026-01-01T12:00:00.000Z')
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId: 'side-b',
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
      equipmentEvent('ATHLETE_EQUIPMENT_END', {
        entryId: 'side-b',
        corner: 'red',
        createdAt: new Date(t0.getTime() + ATHLETE_EQUIPMENT_TIMEOUT_MS),
        accumulatedMs: ATHLETE_EQUIPMENT_TIMEOUT_MS,
        sessionMs: ATHLETE_EQUIPMENT_TIMEOUT_MS,
      }),
    ]

    const result = routeMatControlCommand({
      execution: baseExecution({ liveRevision: 2, nextEventSequence: 2 }),
      session,
      participants,
      events,
      now: new Date(t0.getTime() + ATHLETE_EQUIPMENT_TIMEOUT_MS),
      envelope: {
        operationId: '00000000-0000-4000-8000-000000000002',
        holderToken: 'holder',
        expectedLiveRevision: 2,
        expectedAttemptNumber: 1,
      },
      intent: 'ATHLETE_EQUIPMENT_DISQUALIFY',
      payload: {
        entryId: entryIdForCorner('red', participants),
        corner: 'red',
      },
    })

    expect(result.createdEvents).toHaveLength(1)
    expect(result.createdEvents[0]?.eventType).toBe('BOUT_STOPPAGE')
    const payload = result.createdEvents[0]?.payload as {
      proposedDecisionReason?: string
      proposedVictoryMethod?: string
      loserEntryId?: string
      winnerEntryId?: string
    }
    expect(payload?.proposedDecisionReason).toBe('DISQUALIFICATION')
    expect(payload?.proposedVictoryMethod).toBe('DISQUALIFICATION')
    expect(payload?.loserEntryId).toBe('side-b')
    expect(payload?.winnerEntryId).toBe('side-a')
  })
})
