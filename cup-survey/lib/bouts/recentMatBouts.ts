import type { Prisma } from '@prisma/client'
import type { InternalBout } from './types'

export type RecentMatBoutSummary = {
  boutId: string
  categoryTitle: string
  matchNumber: number
  scheduleDisplayNumber: string
  winnerName: string | null
  loserName: string | null
  mainScore: string
  victoryMethod: string
  confirmedAt: string
}

function athleteName(side: InternalBout['sideA'], entryId: string | null): string | null {
  if (!entryId) return null
  if (side.kind === 'athlete' && side.entryId === entryId) return side.displayName
  return null
}

export async function loadRecentMatBouts(
  tx: Prisma.TransactionClient,
  bouts: InternalBout[],
  completedBoutIds: Set<string>,
  scheduleDisplayByBoutId: Map<string, string> = new Map(),
  limit = 6,
): Promise<RecentMatBoutSummary[]> {
  const completedOnMat = bouts.filter((bout) => completedBoutIds.has(bout.id))
  if (completedOnMat.length === 0) return []

  const results = await tx.boutResult.findMany({
    where: {
      boutId: { in: completedOnMat.map((bout) => bout.id) },
      isCurrent: true,
    },
    orderBy: { resultConfirmedAt: 'desc' },
    take: limit,
  })

  return results.map((result) => {
    const bout = completedOnMat.find((entry) => entry.id === result.boutId)
    const winnerName =
      bout && result.winnerEntryId
        ? athleteName(bout.sideA, result.winnerEntryId) ??
          athleteName(bout.sideB, result.winnerEntryId) ??
          result.winnerEntryId
        : null
    const loserName =
      bout && result.loserEntryId
        ? athleteName(bout.sideA, result.loserEntryId) ??
          athleteName(bout.sideB, result.loserEntryId) ??
          result.loserEntryId
        : null

    return {
      boutId: result.boutId,
      categoryTitle: bout?.categoryTitle ?? '—',
      matchNumber: bout?.matchNumber ?? 0,
      scheduleDisplayNumber: scheduleDisplayByBoutId.get(result.boutId) ?? '',
      winnerName,
      loserName,
      mainScore: `${result.mainRedScore}:${result.mainBlueScore}`,
      victoryMethod: result.victoryMethod,
      confirmedAt: result.resultConfirmedAt.toISOString(),
    }
  })
}
