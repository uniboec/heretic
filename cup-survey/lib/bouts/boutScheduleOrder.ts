import { compareBoutScheduleCategoryKeys } from '../registration/categoryRules'
import type { InternalBout } from './types'

/** Discipline → age → weight → experience, then match number and bout id. */
export function compareBoutsForScheduleTieBreak(a: InternalBout, b: InternalBout): number {
  const keyCompare = compareBoutScheduleCategoryKeys(a.categoryKey, b.categoryKey)
  if (keyCompare !== 0) return keyCompare
  const matchCompare = a.matchNumber - b.matchNumber
  if (matchCompare !== 0) return matchCompare
  return a.id.localeCompare(b.id)
}

function compareCategoryTieBreak(a: InternalBout, b: InternalBout): number {
  return compareBoutsForScheduleTieBreak(a, b)
}

function compareElimination(a: InternalBout, b: InternalBout): number {
  if (a.schedulePhase !== 'elimination' || b.schedulePhase !== 'elimination') {
    throw new Error('compareElimination requires elimination bouts')
  }
  const roundsCompare = b.roundsUntilFinal - a.roundsUntilFinal
  if (roundsCompare !== 0) return roundsCompare
  return compareCategoryTieBreak(a, b)
}

function compareRoundRobin(a: InternalBout, b: InternalBout): number {
  if (a.schedulePhase !== 'round_robin' || b.schedulePhase !== 'round_robin') {
    throw new Error('compareRoundRobin requires round_robin bouts')
  }
  const roundCompare = a.round - b.round
  if (roundCompare !== 0) return roundCompare
  return compareCategoryTieBreak(a, b)
}

export function compareHeadsForInterleave(a: InternalBout, b: InternalBout): number {
  const headCompare = compareCategoryTieBreak(a, b)
  if (headCompare !== 0) return headCompare
  if (a.schedulePhase === 'elimination') return -1
  if (b.schedulePhase === 'elimination') return 1
  return 0
}

export function interleavePhase0Streams(
  elimination: InternalBout[],
  roundRobin: InternalBout[],
): InternalBout[] {
  const result: InternalBout[] = []
  let elimIndex = 0
  let rrIndex = 0

  while (elimIndex < elimination.length || rrIndex < roundRobin.length) {
    const elimHead = elimination[elimIndex]
    const rrHead = roundRobin[rrIndex]

    if (!elimHead) {
      result.push(roundRobin[rrIndex]!)
      rrIndex++
      continue
    }
    if (!rrHead) {
      result.push(elimination[elimIndex]!)
      elimIndex++
      continue
    }

    if (compareHeadsForInterleave(elimHead, rrHead) <= 0) {
      result.push(elimHead)
      elimIndex++
    } else {
      result.push(rrHead)
      rrIndex++
    }
  }

  return result
}

function sortBronzeOrFinals(bouts: InternalBout[]): InternalBout[] {
  return [...bouts].sort(compareCategoryTieBreak)
}

function compareByStageThenSchedule(a: InternalBout, b: InternalBout): number {
  const stageCompare = a.competitionStage - b.competitionStage
  if (stageCompare !== 0) return stageCompare
  return 0
}

export function sortBoutsForSchedule(boutsOfOneMat: InternalBout[]): InternalBout[] {
  const byStage = [...boutsOfOneMat].sort(compareByStageThenSchedule)
  const stages = [...new Set(byStage.map((b) => b.competitionStage))]
  const result: InternalBout[] = []
  for (const stage of stages) {
    const stageBouts = byStage.filter((b) => b.competitionStage === stage)
    result.push(...sortBoutsForScheduleWithinStage(stageBouts))
  }
  return result
}

function sortBoutsForScheduleWithinStage(boutsOfOneMat: InternalBout[]): InternalBout[] {
  const elimination = boutsOfOneMat
    .filter((bout): bout is InternalBout & { schedulePhase: 'elimination' } =>
      bout.schedulePhase === 'elimination',
    )
    .sort(compareElimination)

  const roundRobin = boutsOfOneMat
    .filter((bout): bout is InternalBout & { schedulePhase: 'round_robin' } =>
      bout.schedulePhase === 'round_robin',
    )
    .sort(compareRoundRobin)

  const bronze = boutsOfOneMat.filter((bout) => bout.schedulePhase === 'bronze')
  const finals = boutsOfOneMat.filter((bout) => bout.schedulePhase === 'final')

  const phase0 = interleavePhase0Streams(elimination, roundRobin)

  return [...phase0, ...sortBronzeOrFinals(bronze), ...sortBronzeOrFinals(finals)]
}
