import { describe, expect, it } from 'vitest'
import { boutHasBothAthletes, bracketMatchHasBothAthletes } from '../boutReadiness'

describe('boutHasBothAthletes', () => {
  it('returns true when both sides are athletes', () => {
    expect(
      boutHasBothAthletes({ kind: 'athlete' }, { kind: 'athlete' }),
    ).toBe(true)
  })

  it('returns false when a side is a bracket hint', () => {
    expect(
      boutHasBothAthletes({ kind: 'athlete' }, { kind: 'hint' }),
    ).toBe(false)
  })

  it('returns false when a side is a bye', () => {
    expect(
      boutHasBothAthletes({ kind: 'bye' }, { kind: 'athlete' }),
    ).toBe(false)
  })
})

describe('bracketMatchHasBothAthletes', () => {
  it('returns true when both bracket slots have entry ids', () => {
    expect(
      bracketMatchHasBothAthletes({
        participantA: { entryId: 'a' },
        participantB: { entryId: 'b' },
      }),
    ).toBe(true)
  })

  it('returns false for pending winner hints or bye slots', () => {
    expect(
      bracketMatchHasBothAthletes({
        participantA: { entryId: 'a' },
        participantB: null,
      }),
    ).toBe(false)
    expect(
      bracketMatchHasBothAthletes({
        participantA: null,
        participantB: null,
      }),
    ).toBe(false)
  })
})
