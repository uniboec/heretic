import { randomUUID } from 'node:crypto'
import { prisma } from '../../../prisma'

export async function insertSharedEpisodeTie(input: {
  boutId: string
  redEntryId: string
  blueEntryId: string
  redPoints: number
  bluePoints: number
  operationId: string
  boutElapsedMs?: number
}): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const execution = await tx.boutScheduleExecution.findUniqueOrThrow({
      where: { boutId: input.boutId },
    })
    const episodeId = randomUUID()
    const now = new Date()
    const period = execution.currentPeriod
    const attempt = execution.attemptNumber
    let sequence = execution.nextEventSequence
    const boutElapsedMs = input.boutElapsedMs ?? execution.clockElapsedBeforeStartMs

    for (const item of [
      { corner: 'red', points: input.redPoints, entryId: input.redEntryId },
      { corner: 'blue', points: input.bluePoints, entryId: input.blueEntryId },
    ]) {
      await tx.boutEvent.create({
        data: {
          boutId: input.boutId,
          clientEventId: `${input.operationId}-${item.corner}`,
          sequence,
          eventType: 'TECHNICAL_SCORE',
          entryId: item.entryId,
          cornerAtEvent: item.corner,
          points: item.points,
          episodeId,
          boutElapsedMs,
          period,
          attemptNumber: attempt,
          payload: { source: 'DIRECT' },
          createdAt: now,
        },
      })
      sequence += 1
    }

    const liveRevision = execution.liveRevision + 1
    await tx.boutScheduleExecution.update({
      where: { boutId: input.boutId },
      data: {
        nextEventSequence: sequence,
        liveRevision,
        boutPhase: 'live',
        clockState: execution.clockState === 'idle' ? 'running' : execution.clockState,
      },
    })

    return liveRevision
  })
}
