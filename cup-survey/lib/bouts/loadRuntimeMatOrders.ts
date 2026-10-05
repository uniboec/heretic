import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { prisma } from '../prisma'
import { loadEntryToAthleteMapForBouts } from './athleteIdentity'
import { isAthleteParticipationSpacingEnabled } from './athleteParticipationSpacing'
import { buildMatCompletedBoutIds } from './matBoutCompletion'
import type { NormalizedBoutsPageSettings } from './normalizeBoutsPageSettings'
import type { BoutScheduleOverrides } from './scheduleOverrides'
import { orderMatBoutsForRuntime } from './matRuntimeOrder'
import { buildRuntimeMatOrders, type RuntimeMatOrdersResult } from './runtimeMatOrders'
import type { GroupedBoutsResult, InternalBout } from './types'

export type LoadedRuntimeMatOrders = RuntimeMatOrdersResult & {
  restUntilByEntryId: Map<string, Date>
  activeBoutIdByMat: Map<number, string | null>
  completedBoutIdsByMat: Map<number, Set<string>>
}

export async function loadRuntimeMatOrders(input: {
  groupedMats: GroupedBoutsResult['mats']
  settings: NormalizedBoutsPageSettings
  overrides: BoutScheduleOverrides
  now?: Date
  scopeId?: string
  db?: Prisma.TransactionClient
  /** Active bouts excluded from spacing locks (e.g. while postponing the session bout). */
  omitActiveBoutIds?: Set<string>
}): Promise<LoadedRuntimeMatOrders | null> {
  if (!isAthleteParticipationSpacingEnabled(input.settings.athleteParticipationSpacing)) {
    return null
  }

  const client = input.db ?? prisma
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  const now = input.now ?? new Date()
  const allBoutIds = input.groupedMats.flatMap((mat) => mat.bouts.map((bout) => bout.id))

  const [executions, restRows, sessions] = await Promise.all([
    allBoutIds.length > 0
      ? client.boutScheduleExecution.findMany({
          where: { boutId: { in: allBoutIds } },
          select: {
            boutId: true,
            boutPhase: true,
            actualStartAt: true,
            actualEndAt: true,
          },
        })
      : Promise.resolve([]),
    client.athleteRestState.findMany({
      where: { tournamentScopeId: scopeId },
    }),
    client.matControlSession.findMany({
      where: { tournamentScopeId: scopeId },
    }),
  ])

  const restUntilByEntryId = new Map(
    restRows.filter((row) => !row.invalidatedAt).map((row) => [row.entryId, row.restUntil]),
  )
  const activeBoutIdByMat = new Map(sessions.map((session) => [session.matIndex, session.activeBoutId]))
  const completedBoutIdsByMat = new Map<number, Set<string>>()
  const executionByBoutId = new Map(executions.map((row) => [row.boutId, row]))

  for (const mat of input.groupedMats) {
    const matExecutions = mat.bouts
      .map((bout) => executionByBoutId.get(bout.id))
      .filter((row): row is NonNullable<typeof row> => row != null)
    completedBoutIdsByMat.set(mat.matIndex, buildMatCompletedBoutIds(matExecutions))
  }

  const entryToAthlete = await loadEntryToAthleteMapForBouts(
    input.groupedMats.flatMap((mat) => mat.bouts),
    client,
  )

  const globalCompletedBoutIds = buildMatCompletedBoutIds(executions)
  const activeBoutIds = new Set(
    [...activeBoutIdByMat.values()].filter(
      (boutId): boutId is string =>
        boutId != null && !input.omitActiveBoutIds?.has(boutId),
    ),
  )

  let runtimeOrders: RuntimeMatOrdersResult
  try {
    runtimeOrders = buildRuntimeMatOrders({
      groupedMats: input.groupedMats,
      overrides: input.overrides,
      settings: input.settings,
      entryToAthlete,
      executions,
      restUntilByEntryId,
      completedBoutIds: globalCompletedBoutIds,
      activeBoutIds,
      now,
    })
  } catch {
    return null
  }

  return {
    ...runtimeOrders,
    restUntilByEntryId,
    activeBoutIdByMat,
    completedBoutIdsByMat,
  }
}

export async function resolveOrderedMatBoutsForRuntime(input: {
  groupedMats: GroupedBoutsResult['mats']
  matIndex: number
  settings: NormalizedBoutsPageSettings
  overrides: BoutScheduleOverrides
  now?: Date
  scopeId?: string
  db?: Prisma.TransactionClient
  omitActiveBoutIds?: Set<string>
}): Promise<{
  orderedMatBouts: InternalBout[]
  runtime: LoadedRuntimeMatOrders | null
}> {
  const runtime = await loadRuntimeMatOrders({
    groupedMats: input.groupedMats,
    settings: input.settings,
    overrides: input.overrides,
    now: input.now,
    scopeId: input.scopeId,
    db: input.db,
    omitActiveBoutIds: input.omitActiveBoutIds,
  })

  if (runtime) {
    return {
      orderedMatBouts:
        runtime.perMatOrder.get(input.matIndex) ??
        orderMatBoutsForRuntime({
          groupedMats: input.groupedMats,
          matIndex: input.matIndex,
          overrides: input.overrides,
          settings: input.settings,
        }),
      runtime,
    }
  }

  return {
    orderedMatBouts: orderMatBoutsForRuntime({
      groupedMats: input.groupedMats,
      matIndex: input.matIndex,
      overrides: input.overrides,
      settings: input.settings,
    }),
    runtime: null,
  }
}
