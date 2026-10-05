import { computeDraftDiff } from '../core/diff'
import { getEffectiveBronzeMode, getEffectiveSystemId, resolveCategoryFormat } from '../core/formatRules'
import { getSystemForDraw } from '../core/recalculate'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import { formatFormatRuleLabel } from '../labels'
import { isBoutsRepairRequired } from '../../bouts/repairRequired'
import type { PublicationStateDto } from '../generation/publicationState'
import type { BracketStructure, EligibleEntry } from '../core/types'
export type BracketFormatRuleRow = Awaited<
  ReturnType<typeof import('../../prisma').prisma.bracketFormatRule.findMany>
>[number]

export type DraftCategory = {
  id: string
  categoryKey: string
  discipline: string
  status: string
  statusReason: string | null
  autoSystemId: string | null
  systemOverride: string | null
  autoBronzeMode: 'ONE' | 'TWO' | null
  bronzeModeOverride: 'ONE' | 'TWO' | null
  systemVersion: number | null
  drawSeed: string
  redrawRevision: number
  matIndex: number | null
  competitionStage: number
  participants: Array<{
    id: string
    entryId: string
    seedPosition: number
    seedLocked: boolean
    snapshotDisplayName: string | null
    snapshotClubName: string | null
    snapshotCity: string | null
    snapshotPublicNumber: number | null
  }>
}

export function buildAdminCategoryStructure(
  c: DraftCategory,
  eligibleMap: Map<string, EligibleEntry>,
  effectiveBronzeMode: ReturnType<typeof getEffectiveBronzeMode>,
): BracketStructure | null {
  const system = getSystemForDraw(c.autoSystemId, c.systemOverride, c.systemVersion, false)
  if (!system) return null

  return system.build({
    participants: c.participants.map((p) => {
      const e = eligibleMap.get(p.entryId)
      return {
        entryId: p.entryId,
        displayName: e?.displayName ?? p.snapshotDisplayName ?? '',
        clubName: e?.clubName ?? p.snapshotClubName ?? '',
        city: e?.city ?? p.snapshotCity ?? '',
        clubIdentity: e?.clubIdentity ?? '',
        publicNumber: e?.publicNumber ?? p.snapshotPublicNumber ?? null,
        seedPosition: p.seedPosition,
        seedLocked: p.seedLocked,
      }
    }),
    drawSeed: c.drawSeed,
    options: { bronzeMode: effectiveBronzeMode },
  })
}

export function mapAdminCategoryMetadata(
  c: DraftCategory,
  eligibleMap: Map<string, EligibleEntry>,
  placementMap: Map<string, { categoryKey: string; isManualMove: boolean }>,
  diff: Awaited<ReturnType<typeof computeDraftDiff>>,
  rules: BracketFormatRuleRow[],
  publicationState: PublicationStateDto,
  options?: { includeStructure?: boolean; boutsMatCount?: number },
) {
  const effectiveSystemId = getEffectiveSystemId(c.autoSystemId, c.systemOverride)
  const effectiveBronzeMode = getEffectiveBronzeMode(c.autoBronzeMode, c.bronzeModeOverride)
  const catDiff = diff.categories[c.categoryKey]
  const format = resolveCategoryFormat(c.participants.length, rules)

  return {
    id: c.id,
    categoryKey: c.categoryKey,
    discipline: c.discipline,
    title: getCategoryTitleFromKey(c.categoryKey),
    status: c.status,
    statusReason: c.statusReason,
    autoSystemId: c.autoSystemId,
    systemOverride: c.systemOverride,
    autoBronzeMode: c.autoBronzeMode,
    bronzeModeOverride: c.bronzeModeOverride,
    effectiveSystemId,
    effectiveBronzeMode,
    allowedSystemIds: format.rule?.allowedSystemIds ?? [],
    formatRuleLabel: format.rule
      ? formatFormatRuleLabel(format.rule.systemId, format.rule.defaultBronzeMode)
      : null,
    systemVersion: c.systemVersion,
    drawSeed: c.drawSeed,
    redrawRevision: c.redrawRevision,
    matIndex: c.matIndex,
    competitionStage: c.competitionStage,
    publicVisible: publicationState.visible,
    boutsReleased: publicationState.boutsReleased,
    boutsRepairRequired:
      options?.boutsMatCount != null
        ? isBoutsRepairRequired({
            visible: publicationState.visible,
            boutsReleased: publicationState.boutsReleased,
            storedMatIndex: c.matIndex,
            matCount: options.boutsMatCount,
          })
        : false,
    publicationState,
    compositionStale: catDiff?.compositionStale ?? true,
    seedingStale: catDiff?.seedingStale ?? false,
    balanceStale: catDiff?.balanceStale ?? false,
    diff: catDiff,
    participants: c.participants.map((p) => {
      const e = eligibleMap.get(p.entryId)
      const placement = placementMap.get(p.entryId)
      return {
        id: p.id,
        entryId: p.entryId,
        seedPosition: p.seedPosition,
        seedLocked: p.seedLocked,
        displayName: e?.displayName ?? p.snapshotDisplayName ?? '',
        clubName: e?.clubName ?? p.snapshotClubName ?? '',
        city: e?.city ?? p.snapshotCity ?? '',
        clubKey: e?.clubKey ?? null,
        cityKey: e?.cityKey ?? null,
        strengthTier: e?.strengthTier ?? null,
        publicNumber: e?.publicNumber ?? p.snapshotPublicNumber ?? null,
        gender: e?.gender ?? null,
        isManualMove: placement?.isManualMove ?? false,
      }
    }),
    ...(options?.includeStructure
      ? { structure: buildAdminCategoryStructure(c, eligibleMap, effectiveBronzeMode) }
      : {}),
  }
}
