import { Prisma } from '@prisma/client'
import { applyRecalculateToDraw } from '../core/recalculate'
import { getEffectiveSystemId } from '../core/formatRules'
import type { BracketFormatRuleLike } from '../core/types'
import { BracketSystemRegistry } from '../core/registry'
import { systemSupportsBouts } from '../systemMeta'
import { recomputeDrawStructure } from './recomputeDrawStructure'
import { lockBoutsPageSetting } from '../../bouts/locks'
import { getGroupedBoutsForSchedule } from '../../bouts/schedulePipeline'
import { clearManualOrderAfterCategoryCompositionChange } from '../../bouts/manualOrderCleanup'
import '../systems'

export async function rebuildDrawAfterCompositionChange(
  tx: Prisma.TransactionClient,
  drawId: string,
  rules: BracketFormatRuleLike[],
  participantCount: number,
): Promise<Array<{ code: string; categoryKey?: string; n?: number }>> {
  const drawBefore = await tx.bracketCategoryDraw.findUnique({ where: { id: drawId } })
  const lockedSettings = await lockBoutsPageSetting(tx)
  const groupedBefore = drawBefore
    ? await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, { adminPreview: true })
    : { mats: [], warnings: [] }
  const previousSystemId = drawBefore
    ? getEffectiveSystemId(drawBefore.autoSystemId, drawBefore.systemOverride)
    : null

  const warnings = await applyRecalculateToDraw(tx, drawId, rules, participantCount)

  const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: drawId } })
  if (!draw || draw.status !== 'ACTIVE') return warnings

  const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  if (!effectiveSystemId) return warnings

  const system = BracketSystemRegistry.tryGetLatest(effectiveSystemId)
  if (!system) return warnings

  await tx.bracketCategoryDraw.update({
    where: { id: drawId },
    data: { systemVersion: system.version },
  })

  const nowChampion = !systemSupportsBouts(effectiveSystemId)
  const wasChampion = previousSystemId ? !systemSupportsBouts(previousSystemId) : false
  if (nowChampion && !wasChampion) {
    await tx.bracketPublicationState.updateMany({
      where: { categoryKey: draw.categoryKey },
      data: {
        boutsReleased: false,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: null,
      },
    })
  }

  await recomputeDrawStructure(tx, drawId)

  if (drawBefore) {
    await clearManualOrderAfterCategoryCompositionChange(tx, drawBefore.categoryKey, groupedBefore)
  }

  return warnings
}
