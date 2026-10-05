import { tournamentInfo, TOURNAMENT_TIMEZONE } from '../config/tournament'
import { toTournamentInstant } from '../datetime/tournament'
import { applyMatQueueAfterOverrides } from './applyMatQueueAfterOverrides'
import { sortBoutsForSchedule } from './boutScheduleOrder'
import { buildDistributedSchedulesWithFallback } from './distributedSchedule'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { resolveMatStartTime } from './startTimes'
import type { GroupedBoutsResult, InternalBout } from './types'

export function orderMatBoutsForRuntime(input: {
  groupedMats: GroupedBoutsResult['mats']
  matIndex: number
  overrides: BoutScheduleOverrides
  settings: NormalizedBoutsPageSettings
  eventDate?: string
}): InternalBout[] {
  const mat = input.groupedMats.find((entry) => entry.matIndex === input.matIndex)
  if (!mat || mat.bouts.length === 0) return []

  const eventDate = input.eventDate ?? tournamentInfo.eventDate
  const boutsByMat = new Map(input.groupedMats.map((entry) => [entry.matIndex, entry.bouts]))
  const matStartTimes = new Map(
    input.groupedMats.map((entry) => [
      entry.matIndex,
      toTournamentInstant({
        eventDate,
        localTime: resolveMatStartTime(entry.matIndex, input.settings),
        timeZone: TOURNAMENT_TIMEZONE,
      }),
    ]),
  )

  const plans = buildDistributedSchedulesWithFallback({
    boutsByMat,
    overrides: input.overrides,
    settings: input.settings,
    matStartTimes,
    eventDate,
  })

  const baseOrder =
    plans.get(input.matIndex)?.map((plan) => plan.bout) ?? sortBoutsForSchedule(mat.bouts)
  return resolveMatQueueAfterOrder(baseOrder, input.overrides)
}

export function resolveMatQueueAfterOrder(
  baseOrder: InternalBout[],
  overrides: BoutScheduleOverrides,
): InternalBout[] {
  let order = baseOrder
  for (let pass = 0; pass < 16; pass += 1) {
    const next = applyMatQueueAfterOverrides(order, overrides)
    const unchanged =
      next.length === order.length && next.every((bout, index) => bout.id === order[index]?.id)
    if (unchanged) return next
    order = next
  }
  return order
}

/** Apply queue-after overrides on top of an existing runtime order (e.g. after postpone). */
export function applyMatQueueAfterOnRuntimeOrder(
  runtimeOrder: InternalBout[],
  overrides: BoutScheduleOverrides,
): InternalBout[] {
  return applyMatQueueAfterOverrides(runtimeOrder, overrides)
}

/** Adjust queue-after overrides until cold runtime order matches the target mat order. */
export function stabilizeMatQueueAfterOverrides(input: {
  groupedMats: GroupedBoutsResult['mats']
  matIndex: number
  settings: NormalizedBoutsPageSettings
  targetOrder: InternalBout[]
  overrides: BoutScheduleOverrides
  maxPasses?: number
}): BoutScheduleOverrides {
  const targetIds = input.targetOrder.map((bout) => bout.id)
  let nextOverrides = { ...input.overrides }

  for (let pass = 0; pass < (input.maxPasses ?? 48); pass += 1) {
    const coldOrder = orderMatBoutsForRuntime({
      groupedMats: input.groupedMats,
      matIndex: input.matIndex,
      overrides: nextOverrides,
      settings: input.settings,
    })
    const coldIds = coldOrder.map((bout) => bout.id)
    if (coldIds.join('|') === targetIds.join('|')) return nextOverrides

    let updated = false
    for (let index = 1; index < targetIds.length; index += 1) {
      const boutId = targetIds[index]!
      const desiredPrevId = targetIds[index - 1]!
      const coldIndex = coldIds.indexOf(boutId)
      if (coldIndex < 0) continue
      if (coldIds[coldIndex - 1] === desiredPrevId) continue

      nextOverrides = {
        ...nextOverrides,
        [boutId]: {
          ...nextOverrides[boutId],
          queueAfterBoutId: desiredPrevId,
        },
      }
      updated = true
      break
    }

    if (!updated) return nextOverrides
  }

  return nextOverrides
}

/** Like stabilizeMatQueueAfterOverrides, but uses a custom async cold-order resolver. */
export async function stabilizeMatQueueAfterOverridesAsync(input: {
  groupedMats: GroupedBoutsResult['mats']
  matIndex: number
  settings: NormalizedBoutsPageSettings
  targetOrder: InternalBout[]
  overrides: BoutScheduleOverrides
  maxPasses?: number
  resolveColdOrder: (overrides: BoutScheduleOverrides) => Promise<InternalBout[]>
}): Promise<BoutScheduleOverrides> {
  const targetIds = input.targetOrder.map((bout) => bout.id)
  let nextOverrides = { ...input.overrides }

  for (let pass = 0; pass < (input.maxPasses ?? 48); pass += 1) {
    const coldOrder = await input.resolveColdOrder(nextOverrides)
    const coldIds = coldOrder.map((bout) => bout.id)
    if (coldIds.join('|') === targetIds.join('|')) return nextOverrides

    let updated = false
    for (let index = 1; index < targetIds.length; index += 1) {
      const boutId = targetIds[index]!
      const desiredPrevId = targetIds[index - 1]!
      const coldIndex = coldIds.indexOf(boutId)
      if (coldIndex < 0) continue
      if (coldIds[coldIndex - 1] === desiredPrevId) continue

      nextOverrides = {
        ...nextOverrides,
        [boutId]: {
          ...nextOverrides[boutId],
          queueAfterBoutId: desiredPrevId,
        },
      }
      updated = true
      break
    }

    if (!updated) return nextOverrides
  }

  return nextOverrides
}
