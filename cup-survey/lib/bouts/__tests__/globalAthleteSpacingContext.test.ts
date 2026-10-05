import { describe, expect, it } from 'vitest'
import { buildGlobalAthleteSpacingContext } from '../globalAthleteSpacingContext'
import { normalizeAthleteParticipationSpacing } from '../athleteParticipationSpacing'
import { isWavePassed } from '../scheduleWaves'
import { makeTestBout } from './testBoutHelpers'

describe('buildGlobalAthleteSpacingContext', () => {
  it('records MOVED lifecycle at the previous wave after resolver wavePatch', () => {
    const bout = makeTestBout({
      id: 'cat::b2',
      categoryKey: 'cat',
      sideA: {
        kind: 'athlete',
        entryId: 'a1',
        displayName: 'A',
        clubName: 'Club',
        city: 'City',
        publicNumber: 1,
      },
      sideB: {
        kind: 'athlete',
        entryId: 'a2',
        displayName: 'B',
        clubName: 'Club',
        city: 'City',
        publicNumber: 2,
      },
    })

    const context = buildGlobalAthleteSpacingContext({
      allBouts: [bout],
      boutScheduleWaves: { 'cat::b2': 11 },
      wavePatch: { 'cat::b2': 13 },
      entryToAthlete: new Map([['a1', 'athlete-1'], ['a2', 'athlete-2']]),
      executions: [],
      restUntilByEntryId: new Map(),
      spacing: normalizeAthleteParticipationSpacing({
        enabled: true,
        mode: 'BOUT_COUNT',
        regular: 2,
        medal: 5,
      }),
      now: new Date('2026-10-03T12:00:00.000Z'),
    })

    expect(
      context.boutWaveStates.some(
        (state) =>
          state.boutId === 'cat::b2' && state.scheduleWave === 11 && state.lifecycle === 'MOVED',
      ),
    ).toBe(true)
    expect(
      context.boutWaveStates.some(
        (state) =>
          state.boutId === 'cat::b2' && state.scheduleWave === 13 && state.lifecycle === 'PENDING',
      ),
    ).toBe(true)
    expect(isWavePassed(11, context.boutWaveStates)).toBe(true)
  })
})
