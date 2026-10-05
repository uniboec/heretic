import { describe, expect, it } from 'vitest'
import { classifyMatExecutions, getMatExecutionState } from '../getMatExecutionState'
import { BoutsScheduleCorruptError, InvalidBoutExecutionStateError } from '../errors'
import type { ScheduleExecutionRecord } from '../scheduleTypes'
import { makeTestBout } from './testBoutHelpers'

function makeBout(id: string) {
  return makeTestBout({
    id,
    categoryKey: 'tactic_control:novice:m_boys_1:w1',
    categoryTitle: 'Test',
    storedMatIndex: 1,
  })
}

describe('getMatExecutionState', () => {
  it('classifies completed, in_progress, and upcoming in order', () => {
    const bouts = [makeBout('b1'), makeBout('b2'), makeBout('b3')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: new Date(), actualEndAt: new Date() }],
      ['b2', { boutId: 'b2', actualStartAt: new Date(), actualEndAt: null }],
    ])

    expect(classifyMatExecutions(bouts, executions)).toEqual({
      completedIds: ['b1'],
      inProgressId: 'b2',
      upcomingIds: ['b3'],
    })
  })

  it('throws on end without start', () => {
    const bouts = [makeBout('b1')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: null, actualEndAt: new Date() }],
    ])

    expect(() => classifyMatExecutions(bouts, executions)).toThrow(
      InvalidBoutExecutionStateError,
    )
  })

  it('fail-closed wraps invalid state as corrupt', () => {
    const bouts = [makeBout('b1')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: null, actualEndAt: new Date() }],
    ])

    expect(() => getMatExecutionState(bouts, executions, true)).toThrow(
      BoutsScheduleCorruptError,
    )
  })

  it('UNDO: last completed is the tail of completedIds', () => {
    const bouts = [makeBout('b1'), makeBout('b2')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: new Date(), actualEndAt: new Date() }],
      ['b2', { boutId: 'b2', actualStartAt: new Date(), actualEndAt: new Date() }],
    ])

    const classification = classifyMatExecutions(bouts, executions)
    expect(classification.completedIds.at(-1)).toBe('b2')
    expect(classification.inProgressId).toBeNull()
  })

  it('allows completed bout after in-progress when runtime queue was reordered', () => {
    const bouts = [makeBout('b1'), makeBout('b2'), makeBout('b3')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: new Date(), actualEndAt: new Date() }],
      ['b2', { boutId: 'b2', actualStartAt: new Date(), actualEndAt: null }],
      ['b3', { boutId: 'b3', actualStartAt: new Date(), actualEndAt: new Date() }],
    ])

    expect(classifyMatExecutions(bouts, executions)).toEqual({
      completedIds: ['b1', 'b3'],
      inProgressId: 'b2',
      upcomingIds: [],
    })
  })

  it('concurrent START: rejects multiple in_progress rows as invalid state', () => {
    const bouts = [makeBout('b1'), makeBout('b2')]
    const executions = new Map<string, ScheduleExecutionRecord>([
      ['b1', { boutId: 'b1', actualStartAt: new Date(), actualEndAt: null }],
      ['b2', { boutId: 'b2', actualStartAt: new Date(), actualEndAt: null }],
    ])

    expect(() => classifyMatExecutions(bouts, executions)).toThrow(
      InvalidBoutExecutionStateError,
    )
  })
})
