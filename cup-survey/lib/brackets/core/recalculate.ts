import type { OlympicBronzeMode, Prisma } from '@prisma/client'
import '../systems'
import { BracketSystemRegistry } from './registry'
import { resolveCategoryFormat, validateOverrides } from './formatRules'
import type { BracketFormatRuleLike } from './types'

export interface RecalculateDrawInput {
  id: string
  categoryKey: string
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: OlympicBronzeMode | null
  bronzeModeOverride: OlympicBronzeMode | null
  participantCount: number
}

export interface RecalculateResult {
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: OlympicBronzeMode | null
  bronzeModeOverride: OlympicBronzeMode | null
  warnings: Array<{ code: string; categoryKey?: string; n?: number }>
}

export function recalculateDrawFormat(
  draw: RecalculateDrawInput,
  rules: BracketFormatRuleLike[],
): RecalculateResult {
  const n = draw.participantCount
  const format = resolveCategoryFormat(n, rules)
  const warnings: Array<{ code: string; categoryKey?: string; n?: number }> = []

  let autoSystemId: string | null = null
  let autoBronzeMode: OlympicBronzeMode | null = null

  if (format.status === 'ACTIVE' && format.rule) {
    autoSystemId = format.rule.systemId
    autoBronzeMode = format.rule.defaultBronzeMode
  }

  const overrides = validateOverrides(
    draw.categoryKey,
    n,
    format.rule,
    autoSystemId,
    autoBronzeMode,
    draw.systemOverride,
    draw.bronzeModeOverride,
  )

  warnings.push(...overrides.warnings)

  return {
    status: format.status,
    statusReason: format.statusReason ?? null,
    autoSystemId: overrides.autoSystemId,
    systemOverride: overrides.systemOverride,
    autoBronzeMode: overrides.autoBronzeMode,
    bronzeModeOverride: overrides.bronzeModeOverride,
    warnings,
  }
}

export async function applyRecalculateToDraw(
  tx: Prisma.TransactionClient,
  drawId: string,
  rules: BracketFormatRuleLike[],
  participantCount: number,
): Promise<Array<{ code: string; categoryKey?: string; n?: number }>> {
  const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: drawId } })
  if (!draw) return []

  const result = recalculateDrawFormat(
    {
      id: draw.id,
      categoryKey: draw.categoryKey,
      status: draw.status,
      statusReason: draw.statusReason,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      autoBronzeMode: draw.autoBronzeMode,
      bronzeModeOverride: draw.bronzeModeOverride,
      participantCount,
    },
    rules,
  )

  await tx.bracketCategoryDraw.update({
    where: { id: drawId },
    data: {
      status: result.status as 'ACTIVE' | 'INACTIVE' | 'UNSUPPORTED',
      statusReason: result.statusReason as 'NO_FORMAT_RULE' | 'EXCEEDS_MAX_PARTICIPANTS' | 'SYSTEM_UNAVAILABLE' | null,
      autoSystemId: result.autoSystemId,
      systemOverride: result.systemOverride,
      autoBronzeMode: result.autoBronzeMode,
      bronzeModeOverride: result.bronzeModeOverride,
      systemVersion: null,
    },
  })

  return result.warnings
}

export function getSystemForDraw(
  autoSystemId: string | null,
  systemOverride: string | null,
  systemVersion: number | null,
  isPublished: boolean,
) {
  const effectiveId = systemOverride ?? autoSystemId
  if (!effectiveId) return null
  if (isPublished && systemVersion != null) {
    return BracketSystemRegistry.get(effectiveId, systemVersion)
  }
  return BracketSystemRegistry.tryGetLatest(effectiveId)
}
