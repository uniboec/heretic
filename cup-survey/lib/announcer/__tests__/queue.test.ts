import { describe, expect, it } from 'vitest'
import type { AnnouncerEvent } from '@prisma/client'
import { testAnnouncerEvent } from './fixtures'
import { selectReadyCandidate } from '../queue'

function event(overrides: Partial<AnnouncerEvent>): AnnouncerEvent {
  return testAnnouncerEvent({
    audioCacheKey: 'cache',
    audioDurationMs: 1000,
    status: 'READY',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    payload: { boutId: 'b1', matIndex: 1 },
    ...overrides,
  })
}

describe('selectReadyCandidate', () => {
  it('picks highest-priority valid ready event', () => {
    const high = event({ id: 'high', priority: 100, payload: { boutId: 'b1', matIndex: 1 } })
    const low = event({
      id: 'low',
      priority: 20,
      createdAt: new Date('2026-01-01T09:00:00Z'),
      payload: { boutId: 'b1', matIndex: 1 },
      type: 'BOUT_PREPARE',
    })
    const result = selectReadyCandidate([high, low], { boutQueueByMat: { 1: ['b1', 'b2'] } })
    expect(result.target?.id).toBe('high')
    expect(result.expiredIds).toEqual([])
  })

  it('expires stale candidates and returns next valid', () => {
    const stale = event({ id: 'stale', payload: { boutId: 'old', matIndex: 1 } })
    const fresh = event({ id: 'fresh', priority: 80, payload: { boutId: 'b1', matIndex: 1 } })
    const result = selectReadyCandidate([stale, fresh], { boutQueueByMat: { 1: ['b1', undefined] } })
    expect(result.expiredIds).toEqual(['stale'])
    expect(result.target?.id).toBe('fresh')
  })
})
