import { describe, expect, it } from 'vitest'
import type { AnnouncerEvent } from '@prisma/client'
import { isEventStillValid, isPositionBasedAnnouncerEvent } from '../validity'
import { testAnnouncerEvent } from './fixtures'

function event(overrides: Partial<AnnouncerEvent>): AnnouncerEvent {
  return testAnnouncerEvent({
    status: 'READY',
    expiresAt: new Date(Date.now() + 60_000),
    payload: { boutId: 'b1' },
    ...overrides,
  })
}

describe('isEventStillValid', () => {
  it('validates bout call against ordered[0]', () => {
    const valid = isEventStillValid(
      event({ type: 'BOUT_CALL', payload: { boutId: 'b1', matIndex: 1 } }),
      { boutQueueByMat: { 1: ['b1', 'b2'] } },
    )
    expect(valid).toBe(true)
  })

  it('invalidates bout prepare when position changed', () => {
    const valid = isEventStillValid(
      event({ type: 'BOUT_PREPARE', payload: { boutId: 'b2', matIndex: 1 } }),
      { boutQueueByMat: { 1: ['b1', 'b3'] } },
    )
    expect(valid).toBe(false)
  })

  it('invalidates repeat call when wait timer is no longer active', () => {
    const valid = isEventStillValid(
      event({
        type: 'BOUT_CALL',
        payload: {
          boutId: 'b1',
          matIndex: 1,
          repeatCorner: 'blue',
          repeatEntryId: 'entry-blue',
        },
      }),
      { activeRepeatCallKeys: new Set(['b1:entry-red']) },
    )
    expect(valid).toBe(false)
  })

  it('validates repeat call while wait timer is active', () => {
    const valid = isEventStillValid(
      event({
        type: 'BOUT_CALL',
        payload: {
          boutId: 'b1',
          matIndex: 1,
          repeatCorner: 'blue',
          repeatEntryId: 'entry-blue',
        },
      }),
      { activeRepeatCallKeys: new Set(['b1:entry-blue']) },
    )
    expect(valid).toBe(true)
  })

  it('validates bout call when bye bout is skipped in queue positions', () => {
    const valid = isEventStillValid(
      event({ type: 'BOUT_CALL', payload: { boutId: 'real-bout', matIndex: 1 } }),
      { boutQueueByMat: { 1: ['real-bout', 'next-bout'] } },
    )
    expect(valid).toBe(true)
  })

  it('stays valid after TTL when bout is still at queue head', () => {
    const valid = isEventStillValid(
      event({
        type: 'BOUT_CALL',
        payload: { boutId: 'b1', matIndex: 1 },
        expiresAt: new Date(Date.now() - 60_000),
      }),
      { boutQueueByMat: { 1: ['b1', 'b2'] } },
    )
    expect(valid).toBe(true)
  })

  it('validates repeat award call while category stays in ceremony queue', () => {
    const valid = isEventStillValid(
      event({
        type: 'AWARD_CALL',
        payload: {
          queueId: 'award-2',
          repeatPlacementId: 'placement-2',
          placements: [],
        },
      }),
      { orderedAwardQueueIds: ['award-1', 'award-2'] },
    )
    expect(valid).toBe(true)
  })

  it('invalidates bout call when announceable head moved past event', () => {
    const valid = isEventStillValid(
      event({ type: 'BOUT_CALL', payload: { boutId: 'old-bout', matIndex: 1 } }),
      { boutQueueByMat: { 1: ['new-bout', 'next-bout'] } },
    )
    expect(valid).toBe(false)
  })

  it('validates bout result against current result id', () => {
    const valid = isEventStillValid(
      event({
        type: 'BOUT_RESULT',
        payload: { boutId: 'b1', boutResultId: 'result-2' },
      }),
      { currentBoutResultIdByBout: { b1: 'result-2' } },
    )
    expect(valid).toBe(true)
  })

  it('invalidates bout result when a newer result is current', () => {
    const valid = isEventStillValid(
      event({
        type: 'BOUT_RESULT',
        payload: { boutId: 'b1', boutResultId: 'result-1' },
      }),
      { currentBoutResultIdByBout: { b1: 'result-2' } },
    )
    expect(valid).toBe(false)
  })

  it('validates award prepare against second queue position', () => {
    const valid = isEventStillValid(
      event({
        type: 'AWARD_PREPARE',
        payload: { queueId: 'award-2', placements: [] },
      }),
      { orderedAwardQueueIds: ['award-1', 'award-2'] },
    )
    expect(valid).toBe(true)
  })

  it('invalidates repeat award category when category left ceremony queue', () => {
    const valid = isEventStillValid(
      event({
        type: 'AWARD_PREPARE',
        payload: { queueId: 'award-done', repeatCategory: true, placements: [] },
      }),
      { orderedAwardQueueIds: ['award-1', 'award-2'] },
    )
    expect(valid).toBe(false)
  })
})

describe('isPositionBasedAnnouncerEvent', () => {
  it('treats mat call announcements as position-based', () => {
    expect(
      isPositionBasedAnnouncerEvent(
        event({ type: 'BOUT_CALL', dedupeKey: 'BOUT_CALL:mat:1:call:b1:e1', payload: { boutId: 'b1', matIndex: 1 } }),
      ),
    ).toBe(true)
  })

  it('treats repeat and manual announcements as ephemeral', () => {
    expect(
      isPositionBasedAnnouncerEvent(
        event({
          type: 'BOUT_CALL',
          dedupeKey: 'BOUT_REPEAT:b1:entry:0',
          payload: { boutId: 'b1', matIndex: 1, repeatCorner: 'red', repeatEntryId: 'entry' },
        }),
      ),
    ).toBe(false)
    expect(
      isPositionBasedAnnouncerEvent(
        event({
          type: 'AWARD_CALL',
          dedupeKey: 'manual:uuid',
          payload: { queueId: 'q1', repeatCategory: true, placements: [] },
        }),
      ),
    ).toBe(false)
  })
})
