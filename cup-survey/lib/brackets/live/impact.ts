import type { Prisma } from '@prisma/client'
import { loadEligibleEntries, type BracketEligibilitySettings } from '../core/eligibility'
import {
  getRegistrationCategoryIdentity,
  getRegistrationCategoryKey,
} from '../../registration/categoryIdentity'
import { buildLockLevelsMap } from './guard'
import { requireWorkingGeneration, resolveWorkingDraftGeneration } from './generation'
import { stableJsonHash } from './mutationFingerprint'

export type BracketImpactResult = {
  affectedCategoryKeys: string[]
  lockLevels: Record<string, import('./guard').CategoryLockLevel>
  liveGenerationId: string
  liveGenerationVersion: number
  mutationFingerprint: string
}

function groupEligibleByCategory(
  entries: Array<{ entryId: string; effectiveCategoryKey: string }>,
): Map<string, string[]> {
  const byCategory = new Map<string, string[]>()
  for (const entry of entries) {
    const list = byCategory.get(entry.effectiveCategoryKey) ?? []
    list.push(entry.entryId)
    byCategory.set(entry.effectiveCategoryKey, list)
  }
  for (const [key, ids] of byCategory) {
    byCategory.set(key, [...ids].sort())
  }
  return byCategory
}

function categoriesWithCompositionDiff(
  current: Map<string, string[]>,
  next: Map<string, string[]>,
): string[] {
  const keys = new Set([...current.keys(), ...next.keys()])
  const affected: string[] = []
  for (const key of keys) {
    const currentIds = current.get(key) ?? []
    const nextIds = next.get(key) ?? []
    if (currentIds.length !== nextIds.length || currentIds.some((id, index) => id !== nextIds[index])) {
      affected.push(key)
    }
  }
  return affected.sort()
}

async function loadPublicationStatesForKeys(
  tx: Prisma.TransactionClient,
  categoryKeys: string[],
) {
  if (categoryKeys.length === 0) return []
  return tx.bracketPublicationState.findMany({
    where: { categoryKey: { in: categoryKeys } },
  })
}

export type RegistrationMutationImpactScope = {
  entryIds?: string[]
}

async function loadCategoryKeysForRegistrationEntries(
  tx: Prisma.TransactionClient,
  registrationId: string,
  seedCategoryKeys: string[],
  scope?: RegistrationMutationImpactScope,
): Promise<string[]> {
  const registration = await tx.teamRegistration.findUnique({
    where: { id: registrationId },
    include: {
      athletes: {
        include: {
          entries: true,
        },
      },
    },
  })
  if (!registration) {
    return [...new Set(seedCategoryKeys)].sort()
  }

  const entryIdFilter = scope?.entryIds?.length ? new Set(scope.entryIds) : null
  const keys = new Set(seedCategoryKeys)
  const relevantEntryIds: string[] = []

  for (const athlete of registration.athletes) {
    for (const entry of athlete.entries) {
      if (entryIdFilter && !entryIdFilter.has(entry.id)) continue
      relevantEntryIds.push(entry.id)
    }
  }

  if (relevantEntryIds.length === 0) {
    return [...keys].sort()
  }

  const placements = await tx.bracketEntryPlacement.findMany({
    where: { entryId: { in: relevantEntryIds } },
  })
  const placementMap = new Map(placements.map((placement) => [placement.entryId, placement.categoryKey]))

  for (const athlete of registration.athletes) {
    for (const entry of athlete.entries) {
      if (entryIdFilter && !entryIdFilter.has(entry.id)) continue
      const identity = getRegistrationCategoryIdentity(entry, athlete)
      if (!identity) continue
      const sourceKey = getRegistrationCategoryKey(identity)
      keys.add(placementMap.get(entry.id) ?? sourceKey)
    }
  }

  const generation = await resolveWorkingDraftGeneration(tx)
  if (generation) {
    const participantRows = await tx.bracketDrawParticipant.findMany({
      where: {
        entryId: { in: relevantEntryIds },
        draw: { generationId: generation.id },
      },
      include: { draw: { select: { categoryKey: true } } },
    })
    for (const row of participantRows) {
      keys.add(row.draw.categoryKey)
    }
  }

  return [...keys].sort()
}

export async function loadCategoryKeysForEntryIds(
  tx: Prisma.TransactionClient,
  entryIds: string[],
): Promise<string[]> {
  if (entryIds.length === 0) return []

  const entries = await tx.athleteEntry.findMany({
    where: { id: { in: entryIds } },
    include: { athlete: true },
  })
  if (entries.length === 0) return []

  const registrationId = entries[0]!.athlete.registrationId
  return loadCategoryKeysForRegistrationEntries(tx, registrationId, [], { entryIds })
}

export async function computeImpactForRegistrationMutation(
  tx: Prisma.TransactionClient,
  registrationId: string,
  mutationFingerprint: string,
  categoryKeys: string[],
  scope?: RegistrationMutationImpactScope,
): Promise<BracketImpactResult> {
  const generation = await requireWorkingGeneration(tx)
  const affectedCategoryKeys = await loadCategoryKeysForRegistrationEntries(
    tx,
    registrationId,
    categoryKeys,
    scope,
  )
  const publicationStates = await loadPublicationStatesForKeys(tx, affectedCategoryKeys)

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint,
  }
}

export async function computeImpactForForceRebuild(
  tx: Prisma.TransactionClient,
  categoryKeys: string[],
): Promise<BracketImpactResult> {
  const generation = await requireWorkingGeneration(tx)
  const affectedCategoryKeys = [...new Set(categoryKeys)].sort()
  const publicationStates = await loadPublicationStatesForKeys(tx, affectedCategoryKeys)

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint: stableJsonHash({ categoryKeys: affectedCategoryKeys }),
  }
}

export async function computeImpactForSettingsEligibility(
  tx: Prisma.TransactionClient,
  nextSettings: BracketEligibilitySettings,
): Promise<BracketImpactResult> {
  const generation = await requireWorkingGeneration(tx)
  const currentSettings =
    (await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
      includePaid: true,
      includeUnpaid: false,
    }

  const currentEligible = await loadEligibleEntries({
    includePaid: currentSettings.includePaid,
    includeUnpaid: currentSettings.includeUnpaid,
  })
  const nextEligible = await loadEligibleEntries(nextSettings)

  const affectedCategoryKeys = categoriesWithCompositionDiff(
    groupEligibleByCategory(currentEligible),
    groupEligibleByCategory(nextEligible),
  )
  const publicationStates = await loadPublicationStatesForKeys(tx, affectedCategoryKeys)

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint: stableJsonHash({
      includePaid: nextSettings.includePaid,
      includeUnpaid: nextSettings.includeUnpaid,
    }),
  }
}

export async function computeImpactForReset(
  tx: Prisma.TransactionClient,
): Promise<BracketImpactResult> {
  const generation = await requireWorkingGeneration(tx)
  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: generation.id },
    select: { categoryKey: true },
    orderBy: { categoryKey: 'asc' },
  })
  const affectedCategoryKeys = draws.map((draw) => draw.categoryKey)
  const publicationStates = await loadPublicationStatesForKeys(tx, affectedCategoryKeys)

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint: stableJsonHash({ operation: 'reset_live' }),
  }
}

export async function computeImpactForConsolidation(
  tx: Prisma.TransactionClient,
  plan: import('../consolidation/types').ConsolidationPlan,
): Promise<BracketImpactResult> {
  const { hashPlan } = await import('../consolidation/planFingerprint')
  const generation = await requireWorkingGeneration(tx)
  const affectedCategoryKeys = [...plan.affectedCategoryKeys].sort()
  const publicationStates = await loadPublicationStatesForKeys(tx, affectedCategoryKeys)

  return {
    affectedCategoryKeys,
    lockLevels: buildLockLevelsMap(affectedCategoryKeys, publicationStates),
    liveGenerationId: generation.id,
    liveGenerationVersion: generation.version,
    mutationFingerprint: hashPlan(plan),
  }
}
