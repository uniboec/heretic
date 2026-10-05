import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import type { CategoryResult } from '@/lib/brackets/core/types'
import { readCategoryResult } from '@/lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure } from '@/lib/brackets/core/snapshot'
import { resumeOrEnqueueAwardCeremony } from './enqueue'
import { syncAwardCeremonyOnCorrection } from './syncOnCorrection'
import type { CeremonyParticipantInput } from './types'

function mapParticipants(
  participants: Array<{
    entryId: string
    snapshotDisplayName: string | null
    snapshotClubName: string | null
  }>,
): CeremonyParticipantInput[] {
  return participants.map((participant) => ({
    entryId: participant.entryId,
    displayName: participant.snapshotDisplayName ?? participant.entryId,
    clubName: participant.snapshotClubName ?? '',
  }))
}

export async function notifyAwardCeremonyFromPublishedStructure(input: {
  tx: Prisma.TransactionClient
  categoryKey: string
  publishedStructureJson: unknown
  participants: Array<{
    entryId: string
    snapshotDisplayName: string | null
    snapshotClubName: string | null
  }>
  previousResult?: CategoryResult | null
  systemId: string
}): Promise<void> {
  const snapshot = deserializePublishedStructure(input.publishedStructureJson)
  if (!snapshot) return

  const newResult = readCategoryResult(snapshot.structure, input.systemId, {
    participantCount: input.participants.length,
  })
  const previousStatus = input.previousResult?.status
  const newStatus = newResult?.status

  const payload = {
    categoryKey: input.categoryKey,
    result: newResult,
    participants: mapParticipants(input.participants),
  }

  if (newStatus === 'complete' && previousStatus !== 'complete') {
    await resumeOrEnqueueAwardCeremony(input.tx, payload, TOURNAMENT_SCOPE_ID)
    const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
    deferAwardAnnouncerSync()
    return
  }

  if (previousStatus === 'complete' && newStatus === 'in_progress') {
    const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
    deferAwardAnnouncerSync()
    await syncAwardCeremonyOnCorrection(
      input.tx,
      {
        categoryKey: input.categoryKey,
        newResult,
        participants: payload.participants,
        bracketStatus: 'in_progress',
      },
      TOURNAMENT_SCOPE_ID,
    )
    return
  }

  if (newStatus === 'complete' && previousStatus === 'complete') {
    const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
    deferAwardAnnouncerSync()
    await syncAwardCeremonyOnCorrection(
      input.tx,
      {
        categoryKey: input.categoryKey,
        newResult,
        participants: payload.participants,
        bracketStatus: 'complete',
      },
      TOURNAMENT_SCOPE_ID,
    )
  }
}

export async function notifyAwardCeremonyOnStructureFreeze(input: {
  tx: Prisma.TransactionClient
  categoryKey: string
  publishedStructureJson: unknown
  participants: Array<{
    entryId: string
    snapshotDisplayName: string | null
    snapshotClubName: string | null
  }>
  systemId: string
}): Promise<void> {
  const snapshot = deserializePublishedStructure(input.publishedStructureJson)
  if (!snapshot) return

  const result = readCategoryResult(snapshot.structure, input.systemId, {
    participantCount: input.participants.length,
  })
  if (result?.status !== 'complete') return

  await resumeOrEnqueueAwardCeremony(
    input.tx,
    {
      categoryKey: input.categoryKey,
      result,
      participants: mapParticipants(input.participants),
    },
    TOURNAMENT_SCOPE_ID,
  )
  const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  deferAwardAnnouncerSync()
}
