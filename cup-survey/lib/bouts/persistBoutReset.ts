import type { Prisma } from '@prisma/client'
import { reconcileCategoryPublishedStructure } from '../brackets/reconcilePublishedStructure'
import type { BoutCorrectionMeta } from './boutCorrectionMeta'
import {
  getBlockingDownstreamExecutions,
  getCurrentBoutResult,
  invalidateAthleteRestForBouts,
} from './boutResultQueries'
import { CorrectionBlockedError } from './mat-control/errors'
import { mapExecutionRow, mapExecutionToPrismaUpdate } from './matControlMappers'
import { resetBoutExecutionForRerun } from './resetBoutExecutionForRerun'
import type { InternalBout } from './types'

export async function persistBoutReset(input: {
  tx: Prisma.TransactionClient
  bout: InternalBout
  correctionMeta: BoutCorrectionMeta
  requestedBy?: string
}) {
  const blocking = await getBlockingDownstreamExecutions(
    input.tx,
    input.correctionMeta.downstreamBoutIds,
  )
  if (blocking.length > 0) {
    throw new CorrectionBlockedError(blocking.map((row) => row.boutId))
  }

  const current = await getCurrentBoutResult(input.tx, input.bout.id)
  if (current) {
    await input.tx.boutResult.update({
      where: { id: current.id },
      data: {
        isCurrent: false,
        resultStatus: 'INVALIDATED',
        invalidatedAt: new Date(),
        invalidatedBy: input.requestedBy ?? null,
        invalidationReason: 'Сброс поединка',
      },
    })
  }

  if (input.correctionMeta.downstreamBoutIds.length > 0) {
    await input.tx.boutResult.updateMany({
      where: {
        boutId: { in: input.correctionMeta.downstreamBoutIds },
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        resultStatus: 'INVALIDATED',
        invalidatedAt: new Date(),
        invalidatedBy: input.requestedBy ?? null,
        invalidationReason: 'Сброс поединка (downstream)',
      },
    })
  }

  await reconcileCategoryPublishedStructure(input.tx, input.bout.categoryKey)

  await invalidateAthleteRestForBouts(input.tx, [
    input.bout.id,
    ...input.correctionMeta.downstreamBoutIds,
  ])

  for (const downstreamBoutId of input.correctionMeta.downstreamBoutIds) {
    const execution = await input.tx.boutScheduleExecution.findUnique({
      where: { boutId: downstreamBoutId },
    })
    if (!execution) continue

    const reset = resetBoutExecutionForRerun(mapExecutionRow(execution))
    await input.tx.boutScheduleExecution.update({
      where: { boutId: downstreamBoutId },
      data: mapExecutionToPrismaUpdate(reset),
    })
  }
}
