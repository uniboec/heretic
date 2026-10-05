import type { Prisma } from '@prisma/client'
import { tournamentInfo } from '@/lib/config/tournament'
import { toTournamentInstant } from '@/lib/datetime/tournament'
import type { AwardsPageSettings, QueueWithPlacements } from '../types'
import { buildCeremonySchedule } from './buildCeremonySchedule'

export async function assignCeremonySequence(input: {
  tx: Prisma.TransactionClient
  queue: QueueWithPlacements
  settings: AwardsPageSettings
  allQueue: QueueWithPlacements[]
  now: Date
}): Promise<void> {
  if (input.queue.ceremonySequence != null) {
    if (!input.queue.actualStartAt) {
      await input.tx.awardCeremonyQueue.update({
        where: { id: input.queue.id },
        data: { actualStartAt: input.now },
      })
    }
    return
  }

  const nextSeq = input.settings.ceremonySequenceCounter + 1
  await input.tx.awardsPageSetting.update({
    where: { tournamentScopeId: input.queue.tournamentScopeId },
    data: { ceremonySequenceCounter: nextSeq },
  })

  const schedule = buildCeremonySchedule({
    queue: input.allQueue,
    settings: input.settings,
    now: input.now,
  })
  const planned = schedule.find((item) => item.queueId === input.queue.id)
  const scheduledStartAtSnapshot = planned
    ? new Date(planned.timing.scheduledStartAt)
    : toTournamentInstant({
        eventDate: tournamentInfo.eventDate,
        localTime: input.settings.ceremonyStartTime,
      })

  await input.tx.awardCeremonyQueue.update({
    where: { id: input.queue.id },
    data: {
      ceremonySequence: nextSeq,
      scheduledStartAtSnapshot,
      durationMinutesSnapshot: input.settings.ceremonyDurationMinutes,
      breakMinutesSnapshot: input.settings.ceremonyBreakMinutes,
      actualStartAt: input.queue.actualStartAt ?? input.now,
      status: 'IN_PROGRESS',
    },
  })
}
