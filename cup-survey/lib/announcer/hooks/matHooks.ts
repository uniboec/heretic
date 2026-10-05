import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { buildMatCompletedBoutIds } from '@/lib/bouts/matBoutCompletion'
import { buildMatQueueInOrder } from '@/lib/bouts/matQueue'
import { resolveOrderedMatBoutsForRuntime } from '@/lib/bouts/loadRuntimeMatOrders'
import { isAthleteParticipationSpacingEnabled } from '@/lib/bouts/athleteParticipationSpacing'
import { readFullScheduleSnapshot } from '@/lib/bouts/scheduleService'
import type { InternalBout } from '@/lib/bouts/types'
import { prisma } from '@/lib/prisma'
import { syncPosition, createResultEvent } from '../positionState'
import { isAnnouncerEnabled } from '../settings'
import { buildBoutCallPayload, buildBoutResultPayload } from './payloadBuilders'

export function resolveMatAnnouncerPositionIds(
  queueInOrder: Array<{ bout: { id: string } }>,
  options?: {
    boutById?: Map<string, InternalBout>
    matIndex?: number
  },
): { currentId: string | null; prepareId: string | null } {
  const queueIds = queueInOrder.map((item) => item.bout.id)

  if (!options?.boutById || options.matIndex == null) {
    return {
      currentId: queueIds[0] ?? null,
      prepareId: queueIds[1] ?? null,
    }
  }

  const announceableIds = queueIds.filter((id) => {
    const bout = options.boutById!.get(id)
    return Boolean(bout && buildBoutCallPayload(bout, options.matIndex!))
  })

  return {
    currentId: announceableIds[0] ?? null,
    prepareId: announceableIds[1] ?? null,
  }
}

async function loadMatQueueContext(matIndex: number) {
  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  const spacingEnabled = isAthleteParticipationSpacingEnabled(
    snapshot.settings.athleteParticipationSpacing,
  )
  const { orderedMatBouts, runtime } = await resolveOrderedMatBoutsForRuntime({
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
          where: {
            tournamentScopeId_matIndex: {
              tournamentScopeId: TOURNAMENT_SCOPE_ID,
              matIndex,
            },
          },
        })
      )?.activeBoutId ?? null

  const restUntilByEntryId = runtime
    ? runtime.restUntilByEntryId
    : new Map(
        (
          await prisma.athleteRestState.findMany({
            where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
          })
        )
          .filter((r) => !r.invalidatedAt)
          .map((r) => [r.entryId, r.restUntil]),
      )

  const queueInOrder = buildMatQueueInOrder({
    bouts: orderedMatBouts,
    completedBoutIds,
    activeBoutId,
    restUntilByEntryId,
    now: new Date(),
    skipRestBlocks: spacingEnabled,
  })

  const boutById = new Map(orderedMatBouts.map((b) => [b.id, b]))
  return { queueInOrder, boutById }
}

export async function syncMatAnnouncerState(input: {
  matIndex: number
  scopeId?: string
}): Promise<void> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  if (!(await isAnnouncerEnabled(scopeId))) return

  const { queueInOrder, boutById } = await loadMatQueueContext(input.matIndex)
  const { currentId, prepareId } = resolveMatAnnouncerPositionIds(queueInOrder, {
    boutById,
    matIndex: input.matIndex,
  })

  await syncPosition({
    scopeId,
    scopeKey: `mat:${input.matIndex}:call`,
    newPositionId: currentId,
    eventType: 'BOUT_CALL',
    payloadBuilder: (positionId) => {
      const bout = boutById.get(positionId)
      const payload = bout ? buildBoutCallPayload(bout, input.matIndex) : null
      if (!payload) throw new Error(`Announcer payload missing for bout ${positionId}`)
      return payload
    },
    sourceId: currentId,
  })

  await syncPosition({
    scopeId,
    scopeKey: `mat:${input.matIndex}:prepare`,
    newPositionId: prepareId,
    eventType: 'BOUT_PREPARE',
    payloadBuilder: (positionId) => {
      const bout = boutById.get(positionId)
      const payload = bout ? buildBoutCallPayload(bout, input.matIndex) : null
      if (!payload) throw new Error(`Announcer payload missing for bout ${positionId}`)
      return payload
    },
    sourceId: prepareId,
  })
}

export async function syncAllMatsAnnouncerState(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  const settings = await prisma.boutsPageSetting.findUnique({ where: { id: 'default' } })
  const matCount = settings?.matCount ?? 1
  for (let matIndex = 1; matIndex <= matCount; matIndex++) {
    await syncMatAnnouncerState({ matIndex, scopeId })
  }
}

export async function findBoutById(boutId: string): Promise<InternalBout | null> {
  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  for (const mat of snapshot.grouped.mats) {
    const bout = mat.bouts.find((b) => b.id === boutId)
    if (bout) return bout
  }
  return null
}

export async function enqueueBoutResultAnnouncer(input: {
  boutId: string
  matIndex: number
  scopeId?: string
}): Promise<void> {
  const scopeId = input.scopeId ?? TOURNAMENT_SCOPE_ID
  if (!(await isAnnouncerEnabled(scopeId))) return

  const result = await prisma.boutResult.findFirst({
    where: { boutId: input.boutId, isCurrent: true },
    orderBy: { resultVersion: 'desc' },
  })
  if (!result?.winnerEntryId) return

  const bout = await findBoutById(input.boutId)
  if (!bout) return

  const payload = buildBoutResultPayload({
    bout,
    matIndex: input.matIndex,
    boutResultId: result.id,
    winnerEntryId: result.winnerEntryId,
    victoryMethod: result.victoryMethod,
  })
  if (!payload) return

  await createResultEvent({
    scopeId,
    eventType: 'BOUT_RESULT',
    dedupeKey: `BOUT_RESULT:${input.boutId}:${result.id}`,
    payload,
    sourceId: input.boutId,
  })

  await syncMatAnnouncerState({ matIndex: input.matIndex, scopeId })

  const { kickAnnouncerWorker } = await import('../worker')
  kickAnnouncerWorker(scopeId)
}
