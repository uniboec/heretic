import { ATHLETE_DOCTOR_REMOVAL_MS } from './athleteDoctorVisit'
import { ATHLETE_EQUIPMENT_TIMEOUT_MS } from './athleteEquipmentCorrection'
import {
  isPassivityDisqualificationDueFromElapsed,
  msUntilNextPassivityPenalty,
  resolvePassivityElapsedMs,
} from './passivityPenalties'
import { ATHLETE_WAIT_NO_SHOW_MS } from './athleteWait'
import type { AuxiliaryTimersSnapshot } from './auxiliaryTimers'
import { computeRemainingMs } from './stopClockAt'
import type { ClockState, MatControlExecution } from './mat-control/types'

export const LIVE_TIMER_TICK_MS = 250

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function computeLivePeriodRemainingMs(input: {
  clockState: ClockState
  clockStartedAt: Date | string | null
  clockElapsedBeforeStartMs: number
  periodDurationMs: number
  periodDeadlineAt: string | null
  snapshotRemainingMs: number
  /** Client time when `snapshotRemainingMs` was received from the server. */
  snapshotAnchoredAtMs: number | null
  nowMs: number
}): number {
  if (input.clockState === 'running') {
    if (input.snapshotAnchoredAtMs != null) {
      return Math.max(
        0,
        input.snapshotRemainingMs - (input.nowMs - input.snapshotAnchoredAtMs),
      )
    }

    const deadlineMs = toTimestamp(input.periodDeadlineAt)
    if (deadlineMs != null) {
      return Math.max(0, deadlineMs - input.nowMs)
    }

    const startedMs = toTimestamp(input.clockStartedAt)
    if (startedMs != null) {
      const execution = {
        clockState: 'running',
        clockStartedAt: new Date(startedMs),
        clockElapsedBeforeStartMs: input.clockElapsedBeforeStartMs,
      } as MatControlExecution
      return computeRemainingMs(execution, input.periodDurationMs, new Date(input.nowMs))
    }
  }

  return input.snapshotRemainingMs
}

export function computeLiveAuxiliaryTimers(
  snapshot: AuxiliaryTimersSnapshot,
  nowMs: number,
  clock?: Pick<MatControlExecution, 'clockState' | 'clockStartedAt' | 'clockElapsedBeforeStartMs'>,
): AuxiliaryTimersSnapshot {
  const next: AuxiliaryTimersSnapshot = {}

  if (snapshot.athleteDoctorVisits) {
    const athleteDoctorVisits: AuxiliaryTimersSnapshot['athleteDoctorVisits'] = {}
    for (const corner of ['red', 'blue'] as const) {
      const timer = snapshot.athleteDoctorVisits[corner]
      if (!timer) continue
      if (timer.isActive && timer.startedAt) {
        const startedMs = toTimestamp(timer.startedAt)
        const sessionMs = startedMs != null ? Math.max(0, nowMs - startedMs) : 0
        const totalMs = timer.accumulatedMs + sessionMs
        athleteDoctorVisits[corner] = {
          ...timer,
          totalMs,
          removalAvailable: totalMs >= ATHLETE_DOCTOR_REMOVAL_MS,
        }
      } else {
        athleteDoctorVisits[corner] = timer
      }
    }
    if (Object.keys(athleteDoctorVisits).length > 0) {
      next.athleteDoctorVisits = athleteDoctorVisits
    }
  }

  if (snapshot.athleteEquipmentCorrections) {
    const athleteEquipmentCorrections: AuxiliaryTimersSnapshot['athleteEquipmentCorrections'] = {}
    for (const corner of ['red', 'blue'] as const) {
      const timer = snapshot.athleteEquipmentCorrections[corner]
      if (!timer) continue
      if (timer.isActive && timer.startedAt) {
        const startedMs = toTimestamp(timer.startedAt)
        const sessionMs = startedMs != null ? Math.max(0, nowMs - startedMs) : 0
        const totalMs = timer.accumulatedMs + sessionMs
        athleteEquipmentCorrections[corner] = {
          ...timer,
          totalMs,
          disqualifyAvailable: totalMs >= ATHLETE_EQUIPMENT_TIMEOUT_MS,
        }
      } else {
        athleteEquipmentCorrections[corner] = timer
      }
    }
    if (Object.keys(athleteEquipmentCorrections).length > 0) {
      next.athleteEquipmentCorrections = athleteEquipmentCorrections
    }
  }

  if (snapshot.athleteWaits) {
    const athleteWaits: AuxiliaryTimersSnapshot['athleteWaits'] = {}
    for (const corner of ['red', 'blue'] as const) {
      const timer = snapshot.athleteWaits[corner]
      if (!timer) continue
      if (timer.isActive && timer.startedAt) {
        const startedMs = toTimestamp(timer.startedAt)
        const sessionMs = startedMs != null ? Math.max(0, nowMs - startedMs) : 0
        const totalMs = timer.accumulatedMs + sessionMs
        athleteWaits[corner] = {
          ...timer,
          totalMs,
          noShowAvailable: totalMs >= ATHLETE_WAIT_NO_SHOW_MS,
        }
      } else {
        athleteWaits[corner] = timer
      }
    }
    if (Object.keys(athleteWaits).length > 0) {
      next.athleteWaits = athleteWaits
    }
  }

  if (snapshot.secondaryCalls) {
    const secondaryCalls: AuxiliaryTimersSnapshot['secondaryCalls'] = {}
    for (const corner of ['red', 'blue'] as const) {
      const timer = snapshot.secondaryCalls[corner]
      if (!timer) continue
      const deadlineMs = toTimestamp(timer.deadlineAt)
      secondaryCalls[corner] = {
        ...timer,
        remainingMs: deadlineMs != null ? Math.max(0, deadlineMs - nowMs) : timer.remainingMs,
      }
    }
    if (Object.keys(secondaryCalls).length > 0) {
      next.secondaryCalls = secondaryCalls
    }
  }

  if (snapshot.passivity) {
    const penaltiesApplied = snapshot.passivity.penaltiesApplied
    let elapsedMs = snapshot.passivity.elapsedMs
    if (clock?.clockState === 'running') {
      elapsedMs = resolvePassivityElapsedMs({
        passivityStartBoutElapsedMs: snapshot.passivity.startBoutElapsedMs,
        execution: clock as MatControlExecution,
        now: new Date(nowMs),
      })
    }
    next.passivity = {
      ...snapshot.passivity,
      elapsedMs,
      nextPenaltyInMs: msUntilNextPassivityPenalty(elapsedMs, penaltiesApplied),
      disqualificationDue: isPassivityDisqualificationDueFromElapsed({
        elapsedMs,
        penaltiesApplied,
        nextSanction: snapshot.passivity.nextSanction,
      }),
    }
  }

  return next
}

export function matTimersNeedLiveTick(input: {
  clockState: ClockState
  auxiliaryTimers: AuxiliaryTimersSnapshot
}): boolean {
  if (input.clockState === 'running') return true
  if (input.auxiliaryTimers.athleteDoctorVisits) {
    return Object.values(input.auxiliaryTimers.athleteDoctorVisits).some((timer) => timer?.isActive)
  }
  if (input.auxiliaryTimers.athleteEquipmentCorrections) {
    return Object.values(input.auxiliaryTimers.athleteEquipmentCorrections).some(
      (timer) => timer?.isActive,
    )
  }
  if (input.auxiliaryTimers.athleteWaits) {
    return Object.values(input.auxiliaryTimers.athleteWaits).some((timer) => timer?.isActive)
  }
  if (input.auxiliaryTimers.secondaryCalls) {
    return Object.values(input.auxiliaryTimers.secondaryCalls).some(Boolean)
  }
  return false
}
