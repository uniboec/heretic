import type { Prisma } from '@prisma/client'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '../config/tournament'
import { toTournamentInstant } from '../datetime/tournament'
import { loadEntryToAthleteMapForBouts } from './athleteIdentity'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { buildDistributedSchedulesWithFallback } from './distributedSchedule'
import { deepEqualJson } from './executionGuards'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { assignScheduleWavesFromPlans } from './scheduleWaves'
import { resolveMatStartTime } from './startTimes'
import {
  mergeBoutScheduleWaves,
  pruneBoutScheduleWaves,
  sanitizeBoutScheduleWaves,
  type BoutScheduleWaves,
} from './boutScheduleWaves'
import type { GroupedBoutsResult } from './types'

export async function rebuildAndPersistScheduleWaves(
  tx: Prisma.TransactionClient,
  input: {
    grouped: GroupedBoutsResult
    settings: NormalizedBoutsPageSettings
    scheduleOverrides: BoutScheduleOverrides
  },
): Promise<BoutScheduleWaves> {
  if (!isAthleteParticipationSpacingEnabled(input.settings.athleteParticipationSpacing)) {
    return sanitizeBoutScheduleWaves(input.settings.boutScheduleWaves)
  }

  const allBouts = input.grouped.mats.flatMap((mat) => mat.bouts)
  const boutsByMat = new Map(input.grouped.mats.map((mat) => [mat.matIndex, mat.bouts]))
  const matStartTimes = new Map(
    input.grouped.mats.map((mat) => [
      mat.matIndex,
      toTournamentInstant({
        eventDate: tournamentInfo.eventDate,
        localTime: resolveMatStartTime(mat.matIndex, input.settings),
        timeZone: TOURNAMENT_TIMEZONE,
      }),
    ]),
  )
  const entryToAthlete = await loadEntryToAthleteMapForBouts(allBouts, tx)
  const distributedPlans = buildDistributedSchedulesWithFallback({
    boutsByMat,
    overrides: input.scheduleOverrides,
    settings: input.settings,
    matStartTimes,
    eventDate: tournamentInfo.eventDate,
    entryToAthlete,
  })
  const assignedWaves = assignScheduleWavesFromPlans(distributedPlans)
  const validIds = new Set(allBouts.map((bout) => bout.id))
  const nextWaves = pruneBoutScheduleWaves(
    mergeBoutScheduleWaves(input.settings.boutScheduleWaves, assignedWaves),
    validIds,
  )
  await persistBoutScheduleWavesIfChanged(tx, nextWaves, input.settings.boutScheduleWaves)
  return nextWaves
}

export async function persistBoutScheduleWavesIfChanged(
  tx: Prisma.TransactionClient,
  nextWaves: BoutScheduleWaves,
  currentRaw: unknown,
): Promise<void> {
  const current = sanitizeBoutScheduleWaves(currentRaw)
  if (deepEqualJson(current, nextWaves)) return

  await tx.boutsPageSetting.update({
    where: { id: 'default' },
    data: { boutScheduleWaves: nextWaves },
  })
}
