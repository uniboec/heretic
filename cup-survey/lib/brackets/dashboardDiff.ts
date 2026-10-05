import { prisma } from '../prisma'
import { computeDraftDiff } from './core/diff'
import { loadEligibleEntries } from './core/eligibility'
export async function computeDiffForDraft(draftId: string) {
  const settingsRow = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const settings = settingsRow ?? { includePaid: true, includeUnpaid: false }
  const draft = await prisma.bracketGeneration.findUnique({
    where: { id: draftId },
    include: {
      categories: {
        include: { participants: { orderBy: { seedPosition: 'asc' } } },
      },
    },
  })
  if (!draft) return null

  const regState = await prisma.tournamentRegistrationState.findUnique({
    where: { id: 'default' },
  })
  const currentRevision = regState?.revision ?? BigInt(0)

  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))
  const placements = await prisma.bracketEntryPlacement.findMany()
  const placementMap = new Map(
    placements.map((p) => [p.entryId, { categoryKey: p.categoryKey, isManualMove: p.isManualMove }]),
  )

  return computeDraftDiff(
    eligible,
    draft.sourceRevision,
    draft.sourceFingerprint,
    currentRevision,
    draft.categories.map((c) => ({
      categoryKey: c.categoryKey,
      sourceFingerprint: c.sourceFingerprint,
      seedingFingerprint: c.seedingFingerprint,
      drawInputFingerprint: c.drawInputFingerprint,
      drawPolicyId: c.drawPolicyId,
      drawPolicyVersion: c.drawPolicyVersion,
      autoSystemId: c.autoSystemId,
      systemOverride: c.systemOverride,
      systemVersion: c.systemVersion,
      participants: c.participants.map((p) => {
        const e = eligibleMap.get(p.entryId)
        return {
          entryId: p.entryId,
          displayName: e?.displayName ?? p.snapshotDisplayName ?? '',
          seedPosition: p.seedPosition,
          clubIdentity: e?.clubIdentity ?? '',
          strengthTier: e?.strengthTier ?? null,
          clubKey: e?.clubKey ?? null,
          cityKey: e?.cityKey ?? null,
          seedLocked: p.seedLocked,
        }
      }),
    })),
    placementMap,
  )
}
