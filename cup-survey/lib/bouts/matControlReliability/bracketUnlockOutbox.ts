import type { Prisma } from '@prisma/client'
import { applyBoutResultToCompetitionStructure } from '@/lib/brackets/applyBoutResultToCompetitionStructure'

type TransactionClient = Prisma.TransactionClient

export async function enqueueBracketUnlock(
  tx: TransactionClient,
  input: {
    boutId: string
    boutSessionId: string
    categoryKey: string
    winnerEntryId: string | null
    loserEntryId: string | null
    schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
  },
): Promise<void> {
  const existing = await tx.boutBracketUnlockOutbox.findUnique({
    where: { boutSessionId: input.boutSessionId },
  })
  if (existing?.status === 'SUCCESS') {
    return
  }

  if (!existing) {
    await tx.boutBracketUnlockOutbox.create({
      data: {
        boutId: input.boutId,
        boutSessionId: input.boutSessionId,
        status: 'PENDING',
      },
    })
  }

  await applyBoutResultToCompetitionStructure(tx, {
    boutId: input.boutId,
    categoryKey: input.categoryKey,
    winnerEntryId: input.winnerEntryId,
    loserEntryId: input.loserEntryId,
    schedulePhase: input.schedulePhase,
  })

  await tx.boutBracketUnlockOutbox.update({
    where: { boutSessionId: input.boutSessionId },
    data: { status: 'SUCCESS', processedAt: new Date() },
  })
}
