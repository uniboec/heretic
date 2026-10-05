import type { BracketDraftDiff, EligibleEntry, EntryRef, MovedEntryRef } from './types'
import { computeCategoryCompositionFingerprint, computeSourceCompositionFingerprint } from './fingerprint'
import { BracketSystemRegistry } from './registry'
import {
  computeSeedingFingerprint,
  buildSeedingSnapshot,
  buildDrawInputSnapshot,
  computeDrawInputFingerprint,
} from './fingerprint'
import { getEffectiveSystemId } from './formatRules'
import { getDefaultDrawPolicy } from './seeding/drawPolicy'

export interface DrawSnapshot {
  categoryKey: string
  sourceFingerprint: string | null
  seedingFingerprint: string | null
  drawInputFingerprint: string | null
  drawPolicyId: string | null
  drawPolicyVersion: number | null
  autoSystemId: string | null
  systemOverride: string | null
  systemVersion: number | null
  participants: Array<{
    entryId: string
    displayName: string
    seedPosition: number
    clubIdentity: string
    strengthTier: number | null
    clubKey: string | null
    cityKey: string | null
    seedLocked: boolean
  }>
}

export function computeDraftDiff(
  eligible: EligibleEntry[],
  generationSourceRevision: bigint | null,
  generationSourceFingerprint: string | null,
  currentRevision: bigint,
  draws: DrawSnapshot[],
  placements: Map<string, { categoryKey: string; isManualMove: boolean }>,
): BracketDraftDiff {
  const currentSourceFingerprint = computeSourceCompositionFingerprint(eligible)
  const registrationDataStale =
    generationSourceRevision != null && currentRevision !== generationSourceRevision
  const eligibilityCriteriaStale =
    !registrationDataStale &&
    generationSourceFingerprint != null &&
    currentSourceFingerprint !== generationSourceFingerprint
  const globalCompositionStale = registrationDataStale || eligibilityCriteriaStale

  const eligibleByCategory = new Map<string, EligibleEntry[]>()
  for (const e of eligible) {
    const list = eligibleByCategory.get(e.effectiveCategoryKey) ?? []
    list.push(e)
    eligibleByCategory.set(e.effectiveCategoryKey, list)
  }

  const categories: BracketDraftDiff['categories'] = {}

  for (const draw of draws) {
    const currentIds = eligibleByCategory.get(draw.categoryKey) ?? []
    const currentFingerprint = computeCategoryCompositionFingerprint(
      currentIds.map((e) => ({
        entryId: e.entryId,
        effectiveCategoryKey: e.effectiveCategoryKey,
      })),
    )
    const compositionStale = globalCompositionStale || currentFingerprint !== draw.sourceFingerprint

    const drawEntryIds = new Set(draw.participants.map((p) => p.entryId))
    const currentEntryIds = new Set(currentIds.map((e) => e.entryId))

    const added: EntryRef[] = []
    const removed: EntryRef[] = []
    const moved: MovedEntryRef[] = []

    if (!globalCompositionStale) {
      for (const e of currentIds) {
        if (!drawEntryIds.has(e.entryId)) {
          if (e.sourceCategoryKey !== draw.categoryKey && !placements.has(e.entryId)) {
            moved.push({
              entryId: e.entryId,
              fromCategoryKey: draw.categoryKey,
              toCategoryKey: e.effectiveCategoryKey,
            })
          } else {
            added.push({ entryId: e.entryId, displayName: e.displayName })
          }
        }
      }
      for (const p of draw.participants) {
        if (!currentEntryIds.has(p.entryId)) {
          removed.push({ entryId: p.entryId, displayName: p.displayName })
        }
      }
    }

    let seedingStale = false
    let balanceStale = false
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (effectiveSystemId && draw.participants.length >= 2) {
      const system =
        draw.systemVersion != null
          ? BracketSystemRegistry.get(effectiveSystemId, draw.systemVersion)
          : BracketSystemRegistry.tryGetLatest(effectiveSystemId)
      if (system?.requiresFreshSeeding) {
        const snapshot = buildSeedingSnapshot(
          system.id,
          system.version,
          draw.participants.map((p) => ({
            entryId: p.entryId,
            clubIdentity: p.clubIdentity,
            seedPosition: p.seedPosition,
          })),
        )
        const expected = computeSeedingFingerprint(snapshot)
        seedingStale = expected !== draw.seedingFingerprint

        if (draw.drawInputFingerprint) {
          const policy = getDefaultDrawPolicy()
          const drawInputSnapshot = buildDrawInputSnapshot(
            draw.drawPolicyId ?? policy.drawPolicyId,
            draw.drawPolicyVersion ?? policy.drawPolicyVersion,
            system.id,
            system.version,
            draw.participants.map((participant) => ({
              entryId: participant.entryId,
              strengthTier: participant.strengthTier,
              clubKey: participant.clubKey,
              cityKey: participant.cityKey,
              seedPosition: participant.seedPosition,
              seedLocked: participant.seedLocked,
            })),
          )
          balanceStale =
            computeDrawInputFingerprint(drawInputSnapshot) !== draw.drawInputFingerprint
        }
      }
    }

    categories[draw.categoryKey] = {
      compositionStale,
      seedingStale,
      balanceStale,
      added,
      removed,
      moved,
    }
  }

  return {
    globalCompositionStale,
    registrationDataStale,
    eligibilityCriteriaStale,
    categories,
  }
}
