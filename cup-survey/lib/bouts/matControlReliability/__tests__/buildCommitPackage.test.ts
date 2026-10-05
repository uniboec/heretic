import { describe, expect, it } from 'vitest'
import type { BoutEventRecord } from '../../mat-control/types'
import {
  buildCommitPackageFromBout,
  mergeWalSuffixIntoPackageEvents,
  selectSessionEventsForCommit,
} from '../buildCommitPackage'
import { computeClientCommandEventHash } from '../clientEventHash'
import { computeEventHash } from '../hash'

function sessionEvent(
  sequence: number,
  boutSessionId: string,
  overrides: Partial<BoutEventRecord> = {},
): BoutEventRecord {
  const clientEventId = overrides.clientEventId ?? `cmd-${sequence}`
  const eventHash =
    overrides.eventHash ??
    computeEventHash({
      type: 'CLOCK_START',
      commandId: clientEventId,
      sequenceNo: sequence,
      boutElapsedMs: 0,
      payload: {},
    })
  return {
    id: `e-${sequence}`,
    boutId: 'b1',
    clientEventId,
    sequence,
    eventStatus: 'STAGED',
    boutSessionId,
    eventHash,
    eventType: 'CLOCK_START',
    entryId: null,
    cornerAtEvent: null,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: {},
    undoneAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('buildCommitPackage', () => {
  it('selects only current session STAGED events sorted by sequence', () => {
    const sessionId = 'sess-1'
    const events = [
      sessionEvent(2, sessionId),
      sessionEvent(1, sessionId),
      sessionEvent(1, 'other-session'),
      sessionEvent(3, sessionId, { undoneAt: new Date() }),
      sessionEvent(4, sessionId, { eventStatus: 'COMMITTED' }),
    ]
    const selected = selectSessionEventsForCommit(events, sessionId)
    expect(selected.map((e) => e.sequence)).toEqual([1, 2, 4])
  })

  it('uses event.sequence as sequenceNo in package', () => {
    const sessionId = 'sess-1'
    const events = [sessionEvent(3, sessionId), sessionEvent(5, sessionId)]
    const pkg = buildCommitPackageFromBout({
      boutId: 'b1',
      boutSessionId: sessionId,
      clientSessionId: 'client-a',
      ownershipEpoch: 2,
      events,
      boutView: {
        boutId: 'b1',
        execution: {
          boutPhase: 'pending_confirmation',
          liveRevision: 4,
          attemptNumber: 1,
          clockState: 'stopped',
          officialEndedAt: null,
        },
      } as never,
      result: {
        winnerEntryId: 'w1',
        loserEntryId: 'l1',
        victoryMethod: 'POINTS',
        decisionReason: 'score',
        decidedInPeriod: 'main',
        officialEndedAt: new Date().toISOString(),
        resultConfirmedAt: new Date().toISOString(),
      },
    })
    expect(pkg.events.map((e) => e.sequenceNo)).toEqual([3, 5])
    expect(pkg.packageHash).toHaveLength(64)
  })

  it('merges pending WAL suffix with matching eventHash', () => {
    const sessionId = 'sess-1'
    const base = [
      {
        schemaVersion: 1,
        type: 'CLOCK_START',
        commandId: 'cmd-1',
        sequenceNo: 1,
        boutElapsedMs: 0,
        payload: {},
        eventHash: computeClientCommandEventHash({
          intent: 'CLOCK_START',
          commandId: 'cmd-1',
          sequenceNo: 1,
          payload: { boutElapsedMs: 0 },
        }),
      },
    ]
    const merged = mergeWalSuffixIntoPackageEvents(base, [
      {
        clientSessionId: 'client-a',
        operationId: 'cmd-2',
        boutId: 'b1',
        boutSessionId: sessionId,
        sequenceNo: 2,
        eventHash: computeClientCommandEventHash({
          intent: 'CLOCK_STOP',
          commandId: 'cmd-2',
          sequenceNo: 2,
          payload: { boutElapsedMs: 5000 },
        }),
        intent: 'CLOCK_STOP',
        payload: { boutElapsedMs: 5000 },
        expectedLiveRevision: 0,
        expectedAttemptNumber: 1,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ], sessionId)
    expect(merged.map((e) => e.sequenceNo)).toEqual([1, 2])
  })
})
