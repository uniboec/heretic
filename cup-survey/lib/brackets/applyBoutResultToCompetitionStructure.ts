import type { Prisma } from '@prisma/client'
import { getEffectiveSystemId } from './core/formatRules'
import { lockCompetitionDrawForCategory } from '../bouts/lockCompetitionForBout'
import { applyOlympicBoutResult } from './applyResult/olympic'
import { applyRoundRobinBoutResult } from './applyResult/roundRobin'

export type ApplyBoutResultContext = {
  boutId: string
  categoryKey: string
  systemId?: string
  winnerEntryId: string | null
  loserEntryId: string | null
  schedulePhase: 'elimination' | 'bronze' | 'final' | 'round_robin'
}

export type ApplyBoutResultOutcome = {
  applied: boolean
  systemId: string
  message: string
  affectedBoutIds: string[]
}

/**
 * Routes bracket propagation by systemId inside a transaction.
 */
export async function applyBoutResultToCompetitionStructure(
  tx: Prisma.TransactionClient,
  ctx: ApplyBoutResultContext,
): Promise<ApplyBoutResultOutcome> {
  const pair = await lockCompetitionDrawForCategory(tx, ctx.categoryKey)
  const systemId =
    ctx.systemId ??
    getEffectiveSystemId(pair.draw.autoSystemId, pair.draw.systemOverride) ??
    'olympic'

  switch (systemId) {
    case 'olympic':
    case 'three_way':
    case 'three-way':
      return applyOlympicBoutResult(tx, { ...ctx, systemId }, pair)
    case 'round_robin':
      return applyRoundRobinBoutResult(tx, { ...ctx, systemId }, pair)
    case 'champion':
      return {
        applied: true,
        systemId,
        message: 'Champion category — no downstream slots',
        affectedBoutIds: [],
      }
    default:
      return {
        applied: false,
        systemId,
        message: `Unsupported systemId: ${systemId}`,
        affectedBoutIds: [],
      }
  }
}
