import type { Prisma } from '@prisma/client'
import type { BracketStructure } from './core/types'
import { deserializePublishedStructure } from './core/snapshot'
import { listActiveBoutResultsForCategory } from '../bouts/boutResultQueries'
import { getEffectiveBronzeMode } from './core/formatRules'
import { storedResultIsValidComplete } from './deriveCategoryPlacements'
import {
  getActivePublishedDrawByCategoryKey,
  getActivePublishedGeneration,
} from './generation/publishedDraws'
import { reconcileCategoryPublishedStructure } from './reconcilePublishedStructure'

export function isLazyReconcileDisabled(): boolean {
  return process.env.CUP_DISABLE_LAZY_RECONCILE === '1'
}

function localBoutIdFromFull(boutId: string): string {
  const sep = boutId.lastIndexOf('::')
  return sep >= 0 ? boutId.slice(sep + 2) : boutId
}

export function categoryStructureNeedsLazyReconcile(
  structure: BracketStructure,
  activeResultBoutIds: Iterable<string>,
): boolean {
  const activeLocals = new Set([...activeResultBoutIds].map(localBoutIdFromFull))
  if (activeLocals.size === 0) return false

  if (!structure.result) return true

  for (const match of structure.rounds) {
    if (activeLocals.has(match.id) && !match.winnerEntryId) return true
  }

  for (const bronze of structure.bronzeSlots ?? []) {
    if (activeLocals.has(bronze.id) && !bronze.winnerEntryId) return true
  }

  for (const pair of structure.roundRobinPairs ?? []) {
    const localId = `rr-${pair.matchNumber ?? `${pair.entryIdA}-${pair.entryIdB}`}`
    if (activeLocals.has(localId) && !pair.winnerEntryId) return true
  }

  return false
}

export async function maybeLazyReconcileCategoryPublishedStructure(
  tx: Prisma.TransactionClient,
  categoryKey: string,
): Promise<{ reconciled: boolean }> {
  if (isLazyReconcileDisabled()) {
    return { reconciled: false }
  }

  const generation = await getActivePublishedGeneration(tx)
  if (!generation) return { reconciled: false }

  const pair = await getActivePublishedDrawByCategoryKey(generation, categoryKey, tx)
  if (!pair) return { reconciled: false }

  const snapshot = deserializePublishedStructure(pair.draw.publishedStructureJson)
  if (!snapshot) return { reconciled: false }

  const effectiveBronzeMode = getEffectiveBronzeMode(
    pair.draw.autoBronzeMode,
    pair.draw.bronzeModeOverride,
  )
  if (
    storedResultIsValidComplete(snapshot.structure, {
      systemId: snapshot.systemId,
      bronzeMode: effectiveBronzeMode,
      participantCount: pair.draw.participants.length,
    })
  ) {
    return { reconciled: false }
  }

  const activeResults = await listActiveBoutResultsForCategory(tx, categoryKey)
  if (
    !categoryStructureNeedsLazyReconcile(
      snapshot.structure,
      activeResults.map((result) => result.boutId),
    )
  ) {
    return { reconciled: false }
  }

  const outcome = await reconcileCategoryPublishedStructure(tx, categoryKey)
  return { reconciled: outcome.reconciled }
}
