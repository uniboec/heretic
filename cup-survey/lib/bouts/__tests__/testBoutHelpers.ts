import type { InternalBout, InternalBoutSide } from '../types'
import type { ScheduledBout } from '../scheduleTypes'

const defaultSide: InternalBoutSide = { kind: 'bye' }

export function makeTestBout(
  overrides: Partial<InternalBout> & Pick<InternalBout, 'id' | 'categoryKey'>,
): InternalBout {
  const base = {
    matchNumber: 1,
    categoryTitle: overrides.categoryKey,
    discipline: 'tactic_control',
    storedMatIndex: null,
    competitionStage: 1,
    sideA: defaultSide,
    sideB: defaultSide,
    ...overrides,
  }

  if (base.schedulePhase === 'elimination') {
    return {
      ...base,
      schedulePhase: 'elimination',
      round: base.round ?? 1,
      roundsUntilFinal: base.roundsUntilFinal ?? 1,
    }
  }

  if (base.schedulePhase === 'final') {
    return {
      ...base,
      schedulePhase: 'final',
      round: base.round ?? 3,
    }
  }

  if (base.schedulePhase === 'round_robin') {
    return {
      ...base,
      schedulePhase: 'round_robin',
      round: base.round ?? 1,
    }
  }

  if (base.schedulePhase === 'bronze') {
    return {
      ...base,
      schedulePhase: 'bronze',
    }
  }

  return {
    ...base,
    schedulePhase: 'elimination',
    round: 1,
    roundsUntilFinal: 1,
  }
}

export function makeTestScheduledBout(
  overrides: Partial<ScheduledBout> & Pick<ScheduledBout, 'id' | 'competitionStage'>,
): ScheduledBout {
  const start = '2026-10-03T05:00:00.000Z'
  const end = '2026-10-03T05:03:00.000Z'
  const timing = {
    durationMinutes: 3,
    scheduledStartAt: start,
    scheduledEndAt: end,
    estimatedStartAt: start,
    estimatedEndAt: end,
    status: 'upcoming' as const,
    delayMinutes: 0,
    isDelayed: false,
    ...overrides.timing,
  }
  return {
    matchNumber: 1,
    matIndex: 1,
    categoryKey: 'cat:a',
    categoryTitle: 'Category A',
    discipline: 'tactic_control',
    sideA: { kind: 'bye' },
    sideB: { kind: 'bye' },
    ...overrides,
    timing,
  }
}
