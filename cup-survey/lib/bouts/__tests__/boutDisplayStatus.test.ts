import { describe, expect, it } from 'vitest'
import {
  isBoutExecutionInProgress,
  resolveMatBoutDisplayStatuses,
} from '../presentation/boutDisplayStatus'

describe('boutDisplayStatus', () => {
  it('treats paused live bout as in progress', () => {
    expect(
      isBoutExecutionInProgress({
        boutPhase: 'live',
        clockStartedAt: new Date(),
      }),
    ).toBe(true)
  })

  it('marks the next bout as preparing after in-progress', () => {
    const executions = new Map([
      ['b1', { boutPhase: 'confirmed', actualStartAt: new Date(), actualEndAt: new Date() }],
      ['b2', { boutPhase: 'live', clockStartedAt: new Date() }],
      ['b3', { boutPhase: 'scheduled' }],
      ['b4', { boutPhase: 'scheduled' }],
    ])

    const statuses = resolveMatBoutDisplayStatuses({
      orderedBoutIds: ['b1', 'b2', 'b3', 'b4'],
      executions,
    })

    expect(statuses.get('b1')).toBe('completed')
    expect(statuses.get('b2')).toBe('in_progress')
    expect(statuses.get('b3')).toBe('preparing')
    expect(statuses.get('b4')).toBe('scheduled')
  })
})
