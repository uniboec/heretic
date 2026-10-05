import { describe, expect, it } from 'vitest'
import {
  assertCallOrder,
  assertCornerSwapAllowed,
  assertFirstCallOrder,
  assertNoShowAllowed,
  assertSecondaryCallOrder,
} from '../assertCallOrder'
import {
  BothFirstCallsRequiredError,
  FirstCallAlreadyRecordedError,
  FirstCallOrderViolationError,
  SecondaryCallTimerActiveError,
  SecondaryCallWithoutFirstError,
} from '../mat-control/errors'
import type { BoutEventRecord, BoutParticipantContext } from '../mat-control/types'

const participants: BoutParticipantContext = {
  redEntryId: 'red-1',
  blueEntryId: 'blue-1',
  cornersSwapped: false,
}

function callEvent(
  type: BoutEventRecord['eventType'],
  partial: Partial<BoutEventRecord> = {},
): BoutEventRecord {
  return {
    id: partial.id ?? 'evt-1',
    boutId: 'bout-1',
    clientEventId: partial.clientEventId ?? 'client-1',
    sequence: partial.sequence ?? 1,
    eventType: type,
    entryId: partial.entryId ?? null,
    cornerAtEvent: partial.cornerAtEvent ?? null,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload: partial.payload ?? null,
    undoneAt: null,
    createdAt: partial.createdAt ?? new Date('2026-09-30T10:00:00.000Z'),
  }
}

describe('assertCallOrder', () => {
  it('requires red first call before blue', () => {
    expect(() =>
      assertFirstCallOrder({
        corner: 'blue',
        entryId: 'blue-1',
        events: [],
        participants,
      }),
    ).toThrow(FirstCallOrderViolationError)
  })

  it('allows corner swap even after calls in the current attempt', () => {
    expect(() =>
      assertCornerSwapAllowed(
        [callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red' })],
        1,
      ),
    ).not.toThrow()
  })

  it('requires both first calls before secondary call', () => {
    expect(() =>
      assertSecondaryCallOrder({
        entryId: 'red-1',
        events: [callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red' })],
        participants,
      }),
    ).toThrow(BothFirstCallsRequiredError)
  })

  it('blocks secondary call without first call for entry', () => {
    expect(() =>
      assertSecondaryCallOrder({
        entryId: 'red-1',
        events: [
          callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red', sequence: 1 }),
          callEvent('FIRST_CALL', { entryId: 'blue-1', cornerAtEvent: 'blue', sequence: 2 }),
        ],
        participants,
      }),
    ).not.toThrow()

    expect(() =>
      assertSecondaryCallOrder({
        entryId: 'blue-1',
        events: [callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red' })],
        participants,
      }),
    ).toThrow(SecondaryCallWithoutFirstError)
  })

  it('blocks no-show before secondary timer expires', () => {
    const startedAt = new Date('2026-09-30T10:00:00.000Z')
    const events = [
      callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red', sequence: 1 }),
      callEvent('FIRST_CALL', { entryId: 'blue-1', cornerAtEvent: 'blue', sequence: 2 }),
      callEvent('SECONDARY_CALL', {
        entryId: 'red-1',
        cornerAtEvent: 'red',
        sequence: 3,
        createdAt: startedAt,
      }),
    ]

    expect(() =>
      assertNoShowAllowed({
        entryId: 'red-1',
        events,
        now: new Date(startedAt.getTime() + 30_000),
        attemptNumber: 1,
      }),
    ).toThrow(SecondaryCallTimerActiveError)

    expect(() =>
      assertNoShowAllowed({
        entryId: 'red-1',
        events,
        now: new Date(startedAt.getTime() + 120_000),
        attemptNumber: 1,
      }),
    ).not.toThrow()
  })

  it('blocks repeat FIRST_CALL after NO_SHOW revert preserved call events', () => {
    const events = [
      callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red', sequence: 1 }),
      callEvent('FIRST_CALL', { entryId: 'blue-1', cornerAtEvent: 'blue', sequence: 2 }),
    ]

    expect(() =>
      assertFirstCallOrder({
        corner: 'red',
        entryId: 'red-1',
        events,
        participants,
      }),
    ).toThrow(FirstCallAlreadyRecordedError)
  })

  it('routes corner swap through assertCallOrder without blocking', () => {
    expect(() =>
      assertCallOrder({
        intent: 'CORNER_SWAP',
        events: [callEvent('FIRST_CALL', { entryId: 'red-1', cornerAtEvent: 'red' })],
        participants,
        now: new Date(),
        attemptNumber: 1,
      }),
    ).not.toThrow()
  })
})
