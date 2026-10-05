import { prisma } from '../../prisma'
import { computeDraftDiff } from '../core/diff'
import { loadEligibleEntries } from '../core/eligibility'
import {
  loadPublicationStateMap,
  publicationStateForCategory,
} from '../generation/publicationState'
import { mapAdminCategoryMetadata } from './mapCategoryMetadata'

async function loadBracketPageSettings() {
  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return (
    settings ?? {
      id: 'default',
      publicEnabled: false,
      includePaid: true,
      includeUnpaid: false,
      updatedAt: new Date(),
    }
  )
}

export async function buildCategoryCanonicalDto(draftId: string, categoryKey: string) {
  const settings = await loadBracketPageSettings()
  const rules = await prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
  const draft = await prisma.bracketGeneration.findUnique({
    where: { id: draftId },
    include: {
      categories: {
        where: { categoryKey },
        include: { participants: { orderBy: { seedPosition: 'asc' } } },
      },
    },
  })
  if (!draft?.categories[0]) return null

  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))
  const placements = await prisma.bracketEntryPlacement.findMany()
  const placementMap = new Map(
    placements.map((placement) => [
      placement.entryId,
      { categoryKey: placement.categoryKey, isManualMove: placement.isManualMove },
    ]),
  )
  const regState = await prisma.tournamentRegistrationState.findUnique({ where: { id: 'default' } })
  const diff = computeDraftDiff(
    eligible,
    draft.sourceRevision,
    draft.sourceFingerprint,
    regState?.revision ?? BigInt(0),
    draft.categories.map((category) => ({
      categoryKey: category.categoryKey,
      sourceFingerprint: category.sourceFingerprint,
      seedingFingerprint: category.seedingFingerprint,
      drawInputFingerprint: category.drawInputFingerprint,
      drawPolicyId: category.drawPolicyId,
      drawPolicyVersion: category.drawPolicyVersion,
      autoSystemId: category.autoSystemId,
      systemOverride: category.systemOverride,
      systemVersion: category.systemVersion,
      participants: category.participants.map((participant) => {
        const entry = eligibleMap.get(participant.entryId)
        return {
          entryId: participant.entryId,
          displayName: entry?.displayName ?? participant.snapshotDisplayName ?? '',
          seedPosition: participant.seedPosition,
          clubIdentity: entry?.clubIdentity ?? '',
          strengthTier: entry?.strengthTier ?? null,
          clubKey: entry?.clubKey ?? null,
          cityKey: entry?.cityKey ?? null,
          seedLocked: participant.seedLocked,
        }
      }),
    })),
    placementMap,
  )
  const publicationStateMap = await loadPublicationStateMap()
  const { resolvePublicGeneration } = await import('../live/generation')
  const published = await resolvePublicGeneration()
  const category = draft.categories[0]
  const participantInputs = category.participants.map((participant) => {
    const entry = eligibleMap.get(participant.entryId)
    return {
      entryId: participant.entryId,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
      clubKey: entry?.clubKey ?? null,
      cityKey: entry?.cityKey ?? null,
      strengthTier: entry?.strengthTier ?? null,
    }
  })
  const { computeCategoryDrawBalance } = await import('./computeDrawBalance')
  const drawBalanceReport = computeCategoryDrawBalance(participantInputs)

  return {
    ...mapAdminCategoryMetadata(
      category,
      eligibleMap,
      placementMap,
      diff,
      rules,
      publicationStateForCategory(
        categoryKey,
        publicationStateMap,
        Boolean(published),
      ),
    ),
    drawBalanceReport,
  }
}

export async function buildCategoriesCanonicalDto(draftId: string, categoryKeys: string[]) {
  const uniqueKeys = [...new Set(categoryKeys)]
  const categories = []
  for (const categoryKey of uniqueKeys) {
    const category = await buildCategoryCanonicalDto(draftId, categoryKey)
    if (category) categories.push(category)
  }
  return categories
}
