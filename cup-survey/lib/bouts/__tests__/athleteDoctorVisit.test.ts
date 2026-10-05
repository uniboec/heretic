import { describe, expect, it } from 'vitest'
import {
  assertAthleteDoctorPause,
  assertAthleteDoctorStart,
  assertDoctorRemovalAllowed,
  ATHLETE_DOCTOR_REMOVAL_MS,
  computeAthleteDoctorTimers,
  resolveAthleteDoctorState,
} from '../athleteDoctorVisit'
import {
  AthleteDoctorAlreadyActiveError,
  AthleteDoctorNotActiveError,
  DoctorRemovalNotAllowedError,
} from '../mat-control/errors'
import type { BoutEventRecord } from '../mat-control/types'

function doctorEvent(
  eventType: 'ATHLETE_DOCTOR_START' | 'ATHLETE_DOCTOR_END',
  input: {
    entryId: string
    corner: 'red' | 'blue'
    createdAt: Date
    accumulatedMs?: number
    sessionMs?: number
  },
): BoutEventRecord {
  const payload =
    eventType === 'ATHLETE_DOCTOR_START'
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

describe('athleteDoctorVisit', () => {
  const entryId = 'red-1'
  const t0 = new Date('2026-01-01T12:00:00.000Z')
  const t15 = new Date('2026-01-01T12:00:15.000Z')
  const t20 = new Date('2026-01-01T12:00:20.000Z')
  const t35 = new Date('2026-01-01T12:00:35.000Z')

  it('accumulates paused doctor time across resume cycles', () => {
    const events = [
      doctorEvent('ATHLETE_DOCTOR_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
      doctorEvent('ATHLETE_DOCTOR_END', {
        entryId,
        corner: 'red',
        createdAt: t15,
        accumulatedMs: 15_000,
        sessionMs: 15_000,
      }),
      doctorEvent('ATHLETE_DOCTOR_START', {
        entryId,
        corner: 'red',
        createdAt: t20,
        accumulatedMs: 15_000,
      }),
    ]

    const paused = resolveAthleteDoctorState({ events, entryId, now: t20 })
    expect(paused?.isActive).toBe(true)
    expect(paused?.accumulatedMs).toBe(15_000)
    expect(paused?.totalMs).toBe(15_000)

    const resumed = resolveAthleteDoctorState({ events, entryId, now: t35 })
    expect(resumed?.isActive).toBe(true)
    expect(resumed?.totalMs).toBe(30_000)
    expect(resumed?.removalAvailable).toBe(false)
  })

  it('allows removal after two minutes cumulative', () => {
    const events = [
      doctorEvent('ATHLETE_DOCTOR_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
      doctorEvent('ATHLETE_DOCTOR_END', {
        entryId,
        corner: 'red',
        createdAt: new Date(t0.getTime() + ATHLETE_DOCTOR_REMOVAL_MS),
        accumulatedMs: ATHLETE_DOCTOR_REMOVAL_MS,
        sessionMs: ATHLETE_DOCTOR_REMOVAL_MS,
      }),
    ]

    const paused = resolveAthleteDoctorState({
      events,
      entryId,
      now: new Date(t0.getTime() + ATHLETE_DOCTOR_REMOVAL_MS),
    })
    expect(paused?.isActive).toBe(false)
    expect(paused?.removalAvailable).toBe(true)

    expect(() =>
      assertDoctorRemovalAllowed({
        entryId,
        events,
        now: new Date(t0.getTime() + ATHLETE_DOCTOR_REMOVAL_MS),
        attemptNumber: 1,
      }),
    ).not.toThrow()
  })

  it('rejects double start and pause when inactive', () => {
    const events = [
      doctorEvent('ATHLETE_DOCTOR_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
    ]

    expect(() => assertAthleteDoctorStart({ entryId, events, attemptNumber: 1 })).toThrow(
      AthleteDoctorAlreadyActiveError,
    )
    expect(() => assertAthleteDoctorPause({ entryId, events: [], attemptNumber: 1 })).toThrow(
      AthleteDoctorNotActiveError,
    )
  })

  it('rejects removal before two minutes', () => {
    const events = [
      doctorEvent('ATHLETE_DOCTOR_START', { entryId, corner: 'red', createdAt: t0, accumulatedMs: 0 }),
    ]

    expect(() =>
      assertDoctorRemovalAllowed({ entryId, events, now: t15, attemptNumber: 1 }),
    ).toThrow(DoctorRemovalNotAllowedError)
  })

  it('maps active visit to UI corner when corners are swapped', () => {
    const participants = {
      redEntryId: 'side-a',
      blueEntryId: 'side-b',
      cornersSwapped: true,
    }
    const events = [
      doctorEvent('ATHLETE_DOCTOR_START', {
        entryId: 'side-b',
        corner: 'red',
        createdAt: t0,
        accumulatedMs: 0,
      }),
    ]

    const timers = computeAthleteDoctorTimers({
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
