import { describe, expect, it } from 'vitest'
import {
  assertActiveBout,
  pinSessionActiveBoutIfNeeded,
  shouldPinSessionActiveBout,
} from '../assertActiveBout'
import { ActiveBoutConflictError, NotActiveBoutError } from '../mat-control/errors'
import { baseExecution, defaultSession } from './matControlTestHelpers'

describe('assertActiveBout', () => {
  it('allows pre-fight commands on scheduled bout in queue', () => {
    expect(() =>
      assertActiveBout({
        session: defaultSession,
        boutId: 'bout-1',
        intent: 'FIRST_CALL',
        execution: baseExecution({ boutPhase: 'scheduled' }),
        boutInMatQueue: true,
      }),
    ).not.toThrow()
  })

  it('rejects scoring on non-active bout', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-2' },
        boutId: 'bout-1',
        intent: 'TECHNICAL_SCORE',
        execution: baseExecution({ boutPhase: 'live' }),
        boutInMatQueue: true,
      }),
    ).toThrow(NotActiveBoutError)
  })

  it('allows corner swap during live bout on mat', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-1' },
        boutId: 'bout-1',
        intent: 'CORNER_SWAP',
        execution: baseExecution({ boutPhase: 'live' }),
        boutInMatQueue: true,
      }),
    ).not.toThrow()
  })

  it('allows corner swap after bout is confirmed', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-1' },
        boutId: 'bout-1',
        intent: 'CORNER_SWAP',
        execution: baseExecution({ boutPhase: 'confirmed' }),
        boutInMatQueue: true,
      }),
    ).not.toThrow()
  })

  it('allows OPEN_NEXT_BOUT on confirmed active bout', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-1' },
        boutId: 'bout-1',
        intent: 'OPEN_NEXT_BOUT',
        execution: baseExecution({ boutPhase: 'confirmed' }),
        boutInMatQueue: true,
      }),
    ).not.toThrow()
  })

  it('pins active bout on first scheduled pre-fight command', () => {
    expect(
      shouldPinSessionActiveBout({
        intent: 'FIRST_CALL',
        executionPhase: 'scheduled',
        sessionActiveBoutId: null,
      }),
    ).toBe(true)

    const session = pinSessionActiveBoutIfNeeded({
      session: defaultSession,
      boutId: 'bout-1',
      execution: baseExecution({ boutPhase: 'scheduled' }),
      intent: 'FIRST_CALL',
    })
    expect(session.activeBoutId).toBe('bout-1')
  })

  it('rejects pre-fight on another bout after session is pinned', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-1' },
        boutId: 'bout-2',
        intent: 'FIRST_CALL',
        execution: baseExecution({ boutPhase: 'scheduled' }),
        boutInMatQueue: true,
      }),
    ).toThrow(ActiveBoutConflictError)
  })

  it('allows scheduled stoppage on bout in queue without starting the fight', () => {
    expect(() =>
      assertActiveBout({
        session: defaultSession,
        boutId: 'bout-1',
        intent: 'STOPPAGE_FORFEIT',
        execution: baseExecution({ boutPhase: 'scheduled' }),
        boutInMatQueue: true,
      }),
    ).not.toThrow()
  })

  it('rejects CLOCK_START when another bout is active', () => {
    expect(() =>
      assertActiveBout({
        session: { ...defaultSession, activeBoutId: 'bout-2' },
        boutId: 'bout-1',
        intent: 'CLOCK_START',
        execution: baseExecution({ boutPhase: 'scheduled' }),
        boutInMatQueue: true,
      }),
    ).toThrow(ActiveBoutConflictError)
  })
})
