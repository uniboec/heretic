import type { Prisma } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { BracketOperationError } from '@/lib/brackets/core/errors'
import { getEffectiveSystemId } from '@/lib/brackets/core/formatRules'
import { readCategoryResult } from '@/lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure } from '@/lib/brackets/core/snapshot'
import type { PublishedDrawPair } from '@/lib/brackets/generation/publishedDraws'
import { resumeOrEnqueueAwardCeremony } from './enqueue'
import { bumpQueueRevision, withAwardsScopeLock } from './scopeLock'

function mapCeremonyParticipants(
  participants: PublishedDrawPair['draw']['participants'],
): Array<{ entryId: string; displayName: string; clubName: string }> {
  return participants.map((participant) => ({
    entryId: participant.entryId,
    displayName: participant.snapshotDisplayName ?? participant.entryId,
    clubName: participant.snapshotClubName ?? '',
  }))
}

export async function releasePublishedPairToAwardsSchedule(
  tx: Prisma.TransactionClient,
  pair: PublishedDrawPair,
): Promise<void> {
  const effectiveSystemId = getEffectiveSystemId(pair.draw.autoSystemId, pair.draw.systemOverride)
  const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
  if (!snapshot) {
    throw new BracketOperationError(
      'UNSUPPORTED_CATEGORY',
      'Категория не готова к выпуску в расписание награждения',
    )
  }

  const result = readCategoryResult(snapshot.structure, effectiveSystemId, {
    participantCount: pair.draw.participants.length,
    bronzeMode: pair.draw.bronzeModeOverride ?? pair.draw.autoBronzeMode,
  })
  if (!result || result.status !== 'complete') {
    throw new BracketOperationError(
      'UNSUPPORTED_CATEGORY',
      'Категория не готова к выпуску в расписание награждения',
    )
  }

  await resumeOrEnqueueAwardCeremony(
    tx,
    {
      categoryKey: pair.draw.categoryKey,
      result,
      participants: mapCeremonyParticipants(pair.draw.participants),
    },
    TOURNAMENT_SCOPE_ID,
  )

  await tx.bracketPublicationState.update({
    where: { categoryKey: pair.draw.categoryKey },
    data: {
      boutsReleased: true,
      boutMatAssignments: null,
      matCountAtRelease: null,
    },
  })

  const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  deferAwardAnnouncerSync()
}

export async function unreleasePublishedPairFromAwardsSchedule(
  tx: Prisma.TransactionClient,
  categoryKey: string,
): Promise<void> {
  await withAwardsScopeLock(tx, TOURNAMENT_SCOPE_ID, async () => {
    const queue = await tx.awardCeremonyQueue.findUnique({
      where: {
        tournamentScopeId_categoryKey: {
          tournamentScopeId: TOURNAMENT_SCOPE_ID,
          categoryKey,
        },
      },
    })

    if (!queue) {
      return
    }

    if (queue.status === 'COMPLETED') {
      throw new BracketOperationError(
        'UNSUPPORTED_CATEGORY',
        'Нельзя убрать из расписания категорию с завершённым награждением',
      )
    }

    if (queue.status === 'IN_PROGRESS') {
      throw new BracketOperationError(
        'UNSUPPORTED_CATEGORY',
        'Нельзя убрать из расписания категорию во время награждения',
      )
    }

    await tx.awardCeremonyPlacement.deleteMany({ where: { queueId: queue.id } })
    await tx.awardCeremonyQueue.delete({ where: { id: queue.id } })
    await bumpQueueRevision(tx, TOURNAMENT_SCOPE_ID)
  })

  await tx.bracketPublicationState.update({
    where: { categoryKey },
    data: {
      boutsReleased: false,
      boutMatAssignments: null,
      matCountAtRelease: null,
    },
  })

  const { deferAwardAnnouncerSync } = await import('../announcer/hooks/scheduleAwardSync')
  deferAwardAnnouncerSync()
}
