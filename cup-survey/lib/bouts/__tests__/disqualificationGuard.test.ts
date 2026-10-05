import { describe, expect, it } from 'vitest'
import { DisqualificationConfirmationRequiredError } from '../mat-control/errors'
import { routeMatControlCommand } from '../matControlCommandRouter'
import { baseExecution, defaultParticipants } from './matControlTestHelpers'
import type { BoutEventRecord } from '../mat-control/types'
import { buildPenaltyEventPayload } from '../scoreEngine'

function penaltyEvent(
  corner: 'red' | 'blue',
  sanction: 'WARNING_1' | 'WARNING_2' | 'WARNING_3',
  sequence: number,
): BoutEventRecord {
  const payload = buildPenaltyEventPayload({ ladder: 'GENERAL', sanction })
  return {
    id: `pen-${sequence}`,
    boutId: 'bout-1',
    clientEventId: `c-${sequence}`,
    sequence,
    eventType: 'PENALTY',
    entryId: corner === 'red' ? 'red-1' : 'blue-1',
    cornerAtEvent: corner,
    points: payload.awardedPoints,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload,
    undoneAt: null,
    createdAt: new Date('2026-09-30T10:00:00.000Z'),
  }
}

describe('disqualification server guard', () => {
  it('rejects PENALTY_GENERAL_NEXT when next sanction is DISQUALIFICATION', () => {
    const events: BoutEventRecord[] = [
      penaltyEvent('red', 'WARNING_1', 0),
      penaltyEvent('red', 'WARNING_2', 1),
      penaltyEvent('red', 'WARNING_3', 2),
    ]
    const execution = baseExecution({ boutPhase: 'live', officialStartedAt: new Date('2026-09-30T10:00:00.000Z') })
    const participants = defaultParticipants

    expect(() =>
      routeMatControlCommand({
        execution,
        events,
        participants,
        session: { activeBoutId: 'bout-1', revision: 1, holderToken: 't', expiresAt: null, matIndex: 1, tournamentScopeId: 'ts' },
        intent: 'PENALTY_GENERAL_NEXT',
        payload: { corner: 'red', entryId: 'red-1' },
        envelope: {
          operationId: 'op-1',
          holderToken: 't',
          expectedLiveRevision: execution.liveRevision,
          expectedAttemptNumber: execution.attemptNumber,
        },
        now: new Date('2026-09-30T10:01:00.000Z'),
      }),
    ).toThrow(DisqualificationConfirmationRequiredError)
  })

  it('allows PENALTY_DISQUALIFY with ladder', () => {
    const execution = baseExecution({ boutPhase: 'live', officialStartedAt: new Date('2026-09-30T10:00:00.000Z') })
    const participants = defaultParticipants

    const result = routeMatControlCommand({
      execution,
      events: [],
      participants,
      session: { activeBoutId: 'bout-1', revision: 1, holderToken: 't', expiresAt: null, matIndex: 1, tournamentScopeId: 'ts' },
      intent: 'PENALTY_DISQUALIFY',
      payload: { corner: 'red', entryId: 'red-1', ladder: 'OUT_OF_BOUNDS' },
      envelope: {
        operationId: 'op-2',
        holderToken: 't',
        expectedLiveRevision: execution.liveRevision,
        expectedAttemptNumber: execution.attemptNumber,
      },
      now: new Date('2026-09-30T10:01:00.000Z'),
    })

    const penalty = result.createdEvents.find((e) => e.eventType === 'PENALTY')
    expect(penalty).toBeTruthy()
    expect((penalty?.payload as { ladder?: string }).ladder).toBe('OUT_OF_BOUNDS')
    expect(result.createdEvents.some((e) => e.eventType === 'BOUT_STOPPAGE')).toBe(true)
  })
})
