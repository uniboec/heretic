import { describe, expect, it } from 'vitest'
import type { AnnouncerEvent } from '@prisma/client'
import {
  isPositionAnnouncementCovered,
  scopeEventType,
} from '../positionCoverage'
import { testAnnouncerEvent } from './fixtures'

function boutEvent(
  status: AnnouncerEvent['status'],
  boutId: string,
): AnnouncerEvent {
  return testAnnouncerEvent({
    type: 'BOUT_CALL',
    status,
    payload: { boutId, matIndex: 1 },
  })
}

describe('positionCoverage', () => {
  it('maps scope keys to event types', () => {
    expect(scopeEventType('mat:1:call')).toBe('BOUT_CALL')
    expect(scopeEventType('mat:2:prepare')).toBe('BOUT_PREPARE')
    expect(scopeEventType('award:call')).toBe('AWARD_CALL')
    expect(scopeEventType('award:prepare')).toBe('AWARD_PREPARE')
  })

  it('treats ready events as covered', () => {
    expect(
      isPositionAnnouncementCovered(boutEvent('READY', 'b1'), 'b1', {
        boutQueueByMat: { 1: ['b1', 'b2'] },
      }),
    ).toBe(true)
  })

  it('treats played events as covered while position is still valid', () => {
    expect(
      isPositionAnnouncementCovered(boutEvent('PLAYED', 'b1'), 'b1', {
        boutQueueByMat: { 1: ['b1', 'b2'] },
      }),
    ).toBe(true)
  })

  it('does not treat expired events as covered even if position is still valid', () => {
    expect(
      isPositionAnnouncementCovered(boutEvent('EXPIRED', 'b1'), 'b1', {
        boutQueueByMat: { 1: ['b1', 'b2'] },
      }),
    ).toBe(false)
  })
})
