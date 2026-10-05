import { buildCeremonySchedule } from '@/lib/awards/schedule/buildCeremonySchedule'
import { getAwardsPageSettings } from '@/lib/awards/settings'
import { buildMatCompletedBoutIds } from '@/lib/bouts/matBoutCompletion'
import { buildMatQueueInOrder } from '@/lib/bouts/matQueue'
import { loadRuntimeMatOrders } from '@/lib/bouts/loadRuntimeMatOrders'
import { orderMatBoutsForRuntime } from '@/lib/bouts/matRuntimeOrder'
import { isAthleteParticipationSpacingEnabled } from '@/lib/bouts/athleteParticipationSpacing'
import { readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { prisma } from '@/lib/prisma'
import { buildActiveRepeatCallKeys } from './hooks/repeatCall'
import { resolveMatAnnouncerPositionIds } from './hooks/matHooks'
import type { ValidityContext } from './validity'

export async function buildValidityContext(scopeId = TOURNAMENT_SCOPE_ID): Promise<ValidityContext> {
  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  const awardsSettings = await getAwardsPageSettings(scopeId)
  const matCount = snapshot.settings.matCount ?? 1
  const boutQueueByMat: Record<number, [string | undefined, string | undefined]> = {}
  const spacingEnabled = isAthleteParticipationSpacingEnabled(
    snapshot.settings.athleteParticipationSpacing,
  )
  const runtime = spacingEnabled
    ? await loadRuntimeMatOrders({
        groupedMats: snapshot.grouped.mats,
        settings: snapshot.settings,
        overrides: snapshot.scheduleOverrides,
        scopeId,
      })
    : null

  for (let matIndex = 1; matIndex <= matCount; matIndex++) {
    const orderedMatBouts = runtime
      ? (runtime.perMatOrder.get(matIndex) ??
        orderMatBoutsForRuntime({
          groupedMats: snapshot.grouped.mats,
          matIndex,
          overrides: snapshot.scheduleOverrides,
          settings: snapshot.settings,
        }))
      : orderMatBoutsForRuntime({
          groupedMats: snapshot.grouped.mats,
          matIndex,
          overrides: snapshot.scheduleOverrides,
          settings: snapshot.settings,
        })

    const completedBoutIds = runtime
      ? (runtime.completedBoutIdsByMat.get(matIndex) ?? new Set<string>())
      : buildMatCompletedBoutIds(
          orderedMatBouts.length > 0
            ? await prisma.boutScheduleExecution.findMany({
                where: { boutId: { in: orderedMatBouts.map((b) => b.id) } },
                select: {
                  boutId: true,
                  boutPhase: true,
                  actualStartAt: true,
                  actualEndAt: true,
                },
              })
            : [],
        )

    const activeBoutId = runtime
      ? (runtime.activeBoutIdByMat.get(matIndex) ?? null)
      : (
          await prisma.matControlSession.findUnique({
            where: { tournamentScopeId_matIndex: { tournamentScopeId: scopeId, matIndex } },
          })
        )?.activeBoutId ?? null

    const restUntilByEntryId = runtime
      ? runtime.restUntilByEntryId
      : new Map(
          (
            await prisma.athleteRestState.findMany({ where: { tournamentScopeId: scopeId } })
          )
            .filter((r) => !r.invalidatedAt)
            .map((r) => [r.entryId, r.restUntil]),
        )

    const queue = buildMatQueueInOrder({
      bouts: orderedMatBouts,
      completedBoutIds,
      activeBoutId,
      restUntilByEntryId,
      now: new Date(),
      skipRestBlocks: spacingEnabled,
    })
    const boutById = new Map(orderedMatBouts.map((bout) => [bout.id, bout]))
    const { currentId, prepareId } = resolveMatAnnouncerPositionIds(queue, {
      boutById,
      matIndex,
    })
    boutQueueByMat[matIndex] = [currentId ?? undefined, prepareId ?? undefined]
  }

  const queue = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: scopeId },
    include: { placements: true },
  })
  const scheduled = buildCeremonySchedule({
    queue,
    settings: awardsSettings,
    now: new Date(),
    includeStatuses: ['IN_PROGRESS', 'PENDING'],
  })
  const orderedAwardQueueIds = scheduled.map((row) => row.queueId)

  const currentResults = await prisma.boutResult.findMany({
    where: { isCurrent: true },
    select: { id: true, boutId: true },
  })
  const currentBoutResultIdByBout: Record<string, string> = {}
  for (const row of currentResults) {
    currentBoutResultIdByBout[row.boutId] = row.id
  }

  const activeRepeatCallKeys = await buildActiveRepeatCallKeys(scopeId)

  return {
    boutQueueByMat,
    orderedAwardQueueIds,
    currentBoutResultIdByBout,
    activeRepeatCallKeys,
  }
}
