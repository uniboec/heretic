import { describe, expect, it } from 'vitest'
import {
  assertAthleteEquipmentPause,
  assertAthleteEquipmentStart,
  assertEquipmentDisqualifyAllowed,
  ATHLETE_EQUIPMENT_TIMEOUT_MS,
  computeAthleteEquipmentTimers,
  resolveAthleteEquipmentState,
} from '../athleteEquipmentCorrection'
import {
  AthleteEquipmentAlreadyActiveError,
  AthleteEquipmentNotActiveError,
  EquipmentDisqualifyNotAllowedError,
} from '../mat-control/errors'
import type { BoutEventRecord } from '../mat-control/types'

function equipmentEvent(
  eventType: 'ATHLETE_EQUIPMENT_START' | 'ATHLETE_EQUIPMENT_END',
  input: {
    entryId: string
    corner: 'red' | 'blue'
    createdAt: Date
    accumulatedMs?: number
    sessionMs?: number
  },
): BoutEventRecord {
  const payload =
    eventType === 'ATHLETE_EQUIPMENT_START'
      ? { accumulatedMs: input.accumulatedMs ?? 0 }
      : {
          accumulatedMs: input.accumulatedMs ?? 0,
          sessionMs: input.sessionMs ?? 0,
        }

  return {
    id: `${eventType}-${input.createdAt.getTime()}`,
    boutId: 'bout-1',
    clientEventId: `${eventType}-${input.createdAt.getTime()}`,
    sequence: 1,
    eventType,
    entryId: input.entryId,
    cornerAtEvent: input.corner,
    points: null,
    episodeId: null,
    boutElapsedMs: 0,
    period: 'main',
    attemptNumber: 1,
    payload,
    undoneAt: null,
    createdAt: input.createdAt,
  }
}

describe('athleteEquipmentCorrection', () => {
  const entryId = 'red-1'
  const t0 = new Date('2026-01-01T12:00:00.000Z')
  const t15 = new Date('2026-01-01T12:00:15.000Z')
  const t20 = new Date('2026-01-01T12:00:20.000Z')
  const t35 = new Date('2026-01-01T12:00:35.000Z')

  it('accumulates paused equipment time across resume cycles', () => {
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId,
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
      equipmentEvent('ATHLETE_EQUIPMENT_END', {
        entryId,
        corner: 'red',
        createdAt: t15,
        accumulatedMs: 15_000,
        sessionMs: 15_000,
      }),
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId,
        corner: 'red',
        createdAt: t20,
        accumulatedMs: 15_000,
      }),
    ]

    const paused = resolveAthleteEquipmentState({ events, entryId, now: t20 })
    expect(paused?.isActive).toBe(true)
    expect(paused?.accumulatedMs).toBe(15_000)
    expect(paused?.totalMs).toBe(15_000)

    const resumed = resolveAthleteEquipmentState({ events, entryId, now: t35 })
    expect(resumed?.isActive).toBe(true)
    expect(resumed?.totalMs).toBe(30_000)
    expect(resumed?.disqualifyAvailable).toBe(false)
  })

  it('allows disqualification after two minutes cumulative', () => {
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId,
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
      equipmentEvent('ATHLETE_EQUIPMENT_END', {
        entryId,
        corner: 'red',
        createdAt: new Date(t0.getTime() + ATHLETE_EQUIPMENT_TIMEOUT_MS),
        accumulatedMs: ATHLETE_EQUIPMENT_TIMEOUT_MS,
        sessionMs: ATHLETE_EQUIPMENT_TIMEOUT_MS,
      }),
    ]

    const paused = resolveAthleteEquipmentState({
      events,
      entryId,
      now: new Date(t0.getTime() + ATHLETE_EQUIPMENT_TIMEOUT_MS),
    })
    expect(paused?.isActive).toBe(false)
    expect(paused?.disqualifyAvailable).toBe(true)

    expect(() =>
      assertEquipmentDisqualifyAllowed({
        entryId,
        events,
        now: new Date(t0.getTime() + ATHLETE_EQUIPMENT_TIMEOUT_MS),
        attemptNumber: 1,
      }),
    ).not.toThrow()
  })

  it('rejects double start and pause when inactive', () => {
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId,
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    expect(() => assertAthleteEquipmentStart({ entryId, events, attemptNumber: 1 })).toThrow(
      AthleteEquipmentAlreadyActiveError,
    )
    expect(() => assertAthleteEquipmentPause({ entryId, events: [], attemptNumber: 1 })).toThrow(
      AthleteEquipmentNotActiveError,
    )
  })

  it('rejects disqualification before two minutes', () => {
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId,
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    expect(() =>
      assertEquipmentDisqualifyAllowed({ entryId, events, now: t15, attemptNumber: 1 }),
    ).toThrow(EquipmentDisqualifyNotAllowedError)
  })

  it('maps active correction to UI corner when corners are swapped', () => {
    const participants = {
      redEntryId: 'side-a',
      blueEntryId: 'side-b',
      cornersSwapped: true,
    }
    const events = [
      equipmentEvent('ATHLETE_EQUIPMENT_START', {
        entryId: 'side-b',
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    const timers = computeAthleteEquipmentTimers({
      events,
      participants,
      attemptNumber: 1,
      now: t15,
    })

    expect(timers.red?.isActive).toBe(true)
    expect(timers.red?.totalMs).toBe(15_000)
    expect(timers.blue).toBeUndefined()
  })
})
