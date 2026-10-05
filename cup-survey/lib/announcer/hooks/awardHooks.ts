import { buildCeremonySchedule } from '@/lib/awards/schedule/buildCeremonySchedule'
import { getAwardsPageSettings } from '@/lib/awards/settings'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { prisma } from '@/lib/prisma'
import { syncPosition } from '../positionState'
import { isAnnouncerEnabled } from '../settings'
import type { AwardCallPayload, AwardPlacementPayload } from '../types'

async function buildAwardPayload(queueId: string): Promise<AwardCallPayload | null> {
  const row = await prisma.awardCeremonyQueue.findUnique({
    where: { id: queueId },
    include: { placements: true },
  })
  if (!row) return null
  const placements: AwardPlacementPayload[] = row.placements.map((p) => ({
    placement: p.placement,
    displayName: `${p.lastName} ${p.firstName}${p.middleName ? ` ${p.middleName}` : ''}`.trim(),
    clubName: p.clubName,
  }))
  return {
    queueId: row.id,
    categoryTitle: getCategoryTitleFromKey(row.categoryKey),
    placements,
  }
}

async function orderedPendingQueueIds(scopeId: string): Promise<string[]> {
  const settings = await getAwardsPageSettings(scopeId)
  const queue = await prisma.awardCeremonyQueue.findMany({
    where: { tournamentScopeId: scopeId },
    include: { placements: true },
  })
  const scheduled = buildCeremonySchedule({
    queue,
    settings,
    now: new Date(),
    includeStatuses: ['IN_PROGRESS', 'PENDING'],
  })
  return scheduled.map((s) => s.queueId)
}

export async function syncAwardAnnouncerState(scopeId = TOURNAMENT_SCOPE_ID): Promise<void> {
  if (!(await isAnnouncerEnabled(scopeId))) return

  const ids = await orderedPendingQueueIds(scopeId)
  const callId = ids[0] ?? null
  const prepareId = ids[1] ?? null

  const callPayload = callId ? await buildAwardPayload(callId) : null
  await syncPosition({
    scopeId,
    scopeKey: 'award:call',
    newPositionId: callPayload ? callId : null,
    eventType: 'AWARD_CALL',
    payloadBuilder: () => callPayload!,
    sourceId: callId,
  })

  const preparePayload = prepareId ? await buildAwardPayload(prepareId) : null
  await syncPosition({
    scopeId,
    scopeKey: 'award:prepare',
    newPositionId: preparePayload ? prepareId : null,
    eventType: 'AWARD_PREPARE',
    payloadBuilder: () => preparePayload!,
    sourceId: prepareId,
  })
}
