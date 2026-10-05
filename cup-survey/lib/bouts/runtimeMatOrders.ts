import { loadEntryToAthleteMapForBouts } from './athleteIdentity'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { assignScheduleWavesFromPlans } from './scheduleWaves'
import { buildDistributedSchedulesWithFallback } from './distributedSchedule'
import type { ScheduledBoutPlan } from './scheduleTypes'
import { orderMatBoutsForRuntime, resolveMatQueueAfterOrder } from './matRuntimeOrder'
import {
  getMatOrderFromSpacingResult,
  resolveGlobalAthleteSpacing,
} from './resolveGlobalAthleteSpacing'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import type { AthleteSpacingExecution } from './globalAthleteSpacingContext'
import type { GroupedBoutsResult, InternalBout } from './types'
import type { EntryToAthleteMap } from './athleteIdentity'
import type { BoutScheduleWaves } from './boutScheduleWaves'
import { mergeBoutScheduleWaves } from './boutScheduleWaves'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '../config/tournament'
import { toTournamentInstant } from '../datetime/tournament'
import { resolveMatStartTime } from './startTimes'

export type RuntimeMatOrdersInput = {
  groupedMats: GroupedBoutsResult['mats']
  overrides: BoutScheduleOverrides
  settings: NormalizedBoutsPageSettings
  entryToAthlete: EntryToAthleteMap
  executions: AthleteSpacingExecution[]
  restUntilByEntryId: Map<string, Date>
  completedBoutIds: Set<string>
  activeBoutIds: Set<string>
  now: Date
  eventDate?: string
}

export type RuntimeMatOrdersResult = {
  perMatOrder: Map<number, InternalBout[]>
  boutScheduleWaves: BoutScheduleWaves
  deferredBouts: ReturnType<typeof resolveGlobalAthleteSpacing>['deferredBouts']
}

export function buildRuntimeMatOrders(input: RuntimeMatOrdersInput): RuntimeMatOrdersResult {
  const eventDate = input.eventDate ?? tournamentInfo.eventDate
  const boutsByMat = new Map(input.groupedMats.map((mat) => [mat.matIndex, mat.bouts]))
  const matStartTimes = new Map(
    input.groupedMats.map((mat) => [
      mat.matIndex,
      toTournamentInstant({
        eventDate,
        localTime: resolveMatStartTime(mat.matIndex, input.settings),
        timeZone: TOURNAMENT_TIMEZONE,
      }),
    ]),
  )

  const allBouts = input.groupedMats.flatMap((mat) => mat.bouts)
  const distributedPlans = buildDistributedSchedulesWithFallback({
    boutsByMat,
    overrides: input.overrides,
    settings: input.settings,
    matStartTimes,
    eventDate,
    entryToAthlete: input.entryToAthlete,
  })

  let boutScheduleWaves = { ...input.settings.boutScheduleWaves }
  if (isAthleteParticipationSpacingEnabled(input.settings.athleteParticipationSpacing)) {
    const assigned = assignScheduleWavesFromPlans(distributedPlans)
    boutScheduleWaves = mergeBoutScheduleWaves(boutScheduleWaves, assigned)
  }

  const perMatBaseOrder = new Map<number, InternalBout[]>()
  for (const mat of input.groupedMats) {
    const plannedOrder = distributedPlans.get(mat.matIndex)?.map((plan) => plan.bout)
    const baseOrder = plannedOrder
      ? resolveMatQueueAfterOrder(plannedOrder, input.overrides)
      : orderMatBoutsForRuntime({
          groupedMats: input.groupedMats,
          matIndex: mat.matIndex,
          overrides: input.overrides,
          settings: input.settings,
          eventDate,
        })
    perMatBaseOrder.set(mat.matIndex, baseOrder)
  }

  const spacingResult = resolveGlobalAthleteSpacing({
    perMatBaseOrder,
    completedBoutIds: input.completedBoutIds,
    activeBoutIds: input.activeBoutIds,
    boutScheduleWaves,
    plansByMat: distributedPlans,
    entryToAthlete: input.entryToAthlete,
    spacing: input.settings.athleteParticipationSpacing,
    executions: input.executions,
    restUntilByEntryId: input.restUntilByEntryId,
    now: input.now,
  })

  boutScheduleWaves = mergeBoutScheduleWaves(boutScheduleWaves, spacingResult.wavePatch)

  const perMatOrder = new Map<number, InternalBout[]>()
  for (const mat of input.groupedMats) {
    perMatOrder.set(
      mat.matIndex,
      getMatOrderFromSpacingResult(
        spacingResult,
        mat.matIndex,
        perMatBaseOrder.get(mat.matIndex) ?? [],
      ),
    )
  }

  return {
    perMatOrder,
    boutScheduleWaves,
    deferredBouts: spacingResult.deferredBouts,
  }
}

export async function loadEntryToAthleteForGrouped(
  groupedMats: GroupedBoutsResult['mats'],
): Promise<EntryToAthleteMap> {
  const allBouts = groupedMats.flatMap((mat) => mat.bouts)
  return loadEntryToAthleteMapForBouts(allBouts)
}
