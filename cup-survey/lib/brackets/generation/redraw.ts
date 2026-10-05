import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { loadEligibleEntries } from '../core/eligibility'
import { computeDraftDiff } from '../core/diff'
import { DraftConflictError, VersionConflictError } from '../core/errors'
import { acquireBracketWriteLocks } from '../live/locks'
import { assignBalancedDraw } from '../core/seeding/balancedAssignment'
import { separateClubsExact } from '../core/seeding/clubSeparation'
import { getDefaultDrawPolicy } from '../core/seeding/drawPolicy'
import { toBracketParticipantInput } from '../core/seeding/participantMeta'
import { recomputeDrawFingerprints } from '../core/seeding/recomputeDrawInput'
import { compactSeedPositions } from '../core/seeding/validateSeeds'
import { shuffleWithSeed } from '../core/seeding/prng'
import { getEffectiveSystemId } from '../core/formatRules'
import { getSystemForDraw } from '../core/recalculate'
import { BRACKET_MUTATION_TX_OPTIONS } from '../core/transactionOptions'
import { computeCategoryDrawSeed } from './ensureDraft'
import { ensureLivePublicationPointers } from './publicationState'
import { recomputeDrawStructure } from './recomputeDrawStructure'
import type { BracketParticipantInput } from '../core/types'

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

interface RedrawPlan {
  drawId: string
  categoryKey: string
  redrawRevision: number
  drawSeed: string
  separated: BracketParticipantInput[]
  seedingFingerprint: string
  drawInputFingerprint: string
  drawPolicyId: string
  drawPolicyVersion: number
  balanceReport?: import('../core/seeding/drawBalanceReport').DrawBalanceReport
}

type CategoryDrawWithParticipants = Awaited<
  ReturnType<
    typeof prisma.bracketCategoryDraw.findMany<{
      include: { participants: { orderBy: { seedPosition: 'asc' } } }
    }>
  >
>[number]

function buildRedrawPlans(input: {
  baseSeed: string
  draws: Array<{
    id: string
    categoryKey: string
    status: string
    redrawRevision: number
    autoSystemId: string | null
    systemOverride: string | null
    systemVersion: number | null
    drawPolicyId: string | null
    drawPolicyVersion: number | null
    participants: Array<{
      entryId: string
      seedPosition: number
      seedLocked: boolean
    }>
  }>
  eligibleMap: Map<string, Awaited<ReturnType<typeof loadEligibleEntries>>[number]>
}): RedrawPlan[] {
  const policy = getDefaultDrawPolicy()
  const plans: RedrawPlan[] = []

  for (const draw of input.draws) {
    if (draw.status !== 'ACTIVE') continue
    const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const system = getSystemForDraw(draw.autoSystemId, draw.systemOverride, null, false)
    if (!effectiveSystemId || !system || !system.requiresFreshSeeding) continue

    const redrawRevision = draw.redrawRevision + 1
    const drawSeed = computeCategoryDrawSeed(input.baseSeed, draw.categoryKey, redrawRevision)

    const participants: BracketParticipantInput[] = compactSeedPositions(
      draw.participants.map((participant) =>
        toBracketParticipantInput(participant, input.eligibleMap.get(participant.entryId), {
          displayName: participant.entryId,
          clubName: '',
          city: '',
        }),
      ),
    )

    const lockedPositions = new Map<number, string>()
    for (const participant of participants.filter((item) => item.seedLocked)) {
      lockedPositions.set(participant.seedPosition, participant.entryId)
    }

    let separated: BracketParticipantInput[]
    let balanceReport: RedrawPlan['balanceReport']
    if (effectiveSystemId === 'olympic') {
      const balanced = assignBalancedDraw({
        participants,
        drawSeed,
        lockedPositions,
      })
      separated = balanced.participants
      balanceReport = balanced.report
    } else {
      const toShuffle = participants.filter((participant) => !participant.seedLocked)
      const shuffled = shuffleWithSeed(toShuffle, drawSeed)
      const usedPositions = new Set(lockedPositions.keys())
      let nextPos = 1
      const unlockedWithPositions = shuffled.map((participant) => {
        while (usedPositions.has(nextPos)) nextPos++
        usedPositions.add(nextPos)
        const position = nextPos++
        return { ...participant, seedPosition: position }
      })
      const combined = [
        ...participants.filter((participant) => participant.seedLocked),
        ...unlockedWithPositions,
      ]
      separated = separateClubsExact(combined, drawSeed, lockedPositions).participants
    }

    const fingerprints = recomputeDrawFingerprints(
      {
        ...draw,
        drawPolicyId: policy.drawPolicyId,
        drawPolicyVersion: policy.drawPolicyVersion,
      },
      separated,
    )

    if (!fingerprints.seedingFingerprint || !fingerprints.drawInputFingerprint) continue

    plans.push({
      drawId: draw.id,
      categoryKey: draw.categoryKey,
      redrawRevision,
      drawSeed,
      separated,
      seedingFingerprint: fingerprints.seedingFingerprint,
      drawInputFingerprint: fingerprints.drawInputFingerprint,
      drawPolicyId: fingerprints.drawPolicyId ?? policy.drawPolicyId,
      drawPolicyVersion: fingerprints.drawPolicyVersion ?? policy.drawPolicyVersion,
      balanceReport,
    })
  }

  return plans
}

export async function applyRedrawPlansInTransaction(
  tx: Prisma.TransactionClient,
  plans: RedrawPlan[],
  options?: { resetBoutsReleased?: boolean },
): Promise<void> {
  const resetBoutsReleased = options?.resetBoutsReleased ?? false

  for (const plan of plans) {
    const tempOffset = 100_000
    await Promise.all(
      plan.separated.map((participant) =>
        tx.bracketDrawParticipant.update({
          where: { drawId_entryId: { drawId: plan.drawId, entryId: participant.entryId } },
          data: { seedPosition: tempOffset + participant.seedPosition },
        }),
      ),
    )
    await Promise.all(
      plan.separated.map((participant) =>
        tx.bracketDrawParticipant.update({
          where: { drawId_entryId: { drawId: plan.drawId, entryId: participant.entryId } },
          data: { seedPosition: participant.seedPosition },
        }),
      ),
    )

    await tx.bracketCategoryDraw.update({
      where: { id: plan.drawId },
      data: {
        redrawRevision: plan.redrawRevision,
        drawSeed: plan.drawSeed,
        seedingFingerprint: plan.seedingFingerprint,
        drawInputFingerprint: plan.drawInputFingerprint,
        drawPolicyId: plan.drawPolicyId,
        drawPolicyVersion: plan.drawPolicyVersion,
      },
    })

    if (resetBoutsReleased) {
      await tx.bracketPublicationState.updateMany({
        where: { categoryKey: plan.categoryKey },
        data: {
          boutsReleased: false,
          boutMatAssignments: Prisma.DbNull,
          matCountAtRelease: null,
        },
      })
    }

    await recomputeDrawStructure(tx, plan.drawId)
  }
}

/** Full draw (club separation, balance, fingerprints) for specific categories inside a transaction. */
export async function redrawCategoryDrawsInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    baseSeed: string
    generationId: string
    categoryKeys: string[]
    eligibleMap: Map<string, Awaited<ReturnType<typeof loadEligibleEntries>>[number]>
    resetBoutsReleased?: boolean
  },
): Promise<string[]> {
  const uniqueKeys = [...new Set(input.categoryKeys)]
  if (uniqueKeys.length === 0) return []

  const draws = await tx.bracketCategoryDraw.findMany({
    where: {
      generationId: input.generationId,
      categoryKey: { in: uniqueKeys },
      status: 'ACTIVE',
    },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })

  const plans = buildRedrawPlans({
    baseSeed: input.baseSeed,
    draws,
    eligibleMap: input.eligibleMap,
  })

  await applyRedrawPlansInTransaction(tx, plans, {
    resetBoutsReleased: input.resetBoutsReleased,
  })

  return plans.map((plan) => plan.categoryKey)
}

function mapDrawsForDiff(
  draws: Array<{
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
      seedPosition: number
      seedLocked: boolean
      snapshotDisplayName: string | null
    }>
  }>,
  eligibleMap: Map<string, Awaited<ReturnType<typeof loadEligibleEntries>>[number]>,
) {
  return draws.map((draw) => ({
    categoryKey: draw.categoryKey,
    sourceFingerprint: draw.sourceFingerprint,
    seedingFingerprint: draw.seedingFingerprint,
    drawInputFingerprint: draw.drawInputFingerprint,
    drawPolicyId: draw.drawPolicyId,
    drawPolicyVersion: draw.drawPolicyVersion,
    autoSystemId: draw.autoSystemId,
    systemOverride: draw.systemOverride,
    systemVersion: draw.systemVersion,
    participants: draw.participants.map((participant) => {
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
  }))
}

async function filterStaleDraws(
  draws: CategoryDrawWithParticipants[],
  eligible: Awaited<ReturnType<typeof loadEligibleEntries>>,
  eligibleMap: Map<string, Awaited<ReturnType<typeof loadEligibleEntries>>[number]>,
  draft: { sourceRevision: bigint | null; sourceFingerprint: string | null },
): Promise<CategoryDrawWithParticipants[]> {
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
    mapDrawsForDiff(draws, eligibleMap),
    placementMap,
  )
  return draws.filter((draw) => {
    const catDiff = diff.categories[draw.categoryKey]
    return catDiff?.seedingStale || catDiff?.balanceStale
  })
}

export async function redrawBracketDraft(input: {
  draftId: string
  expectedVersion: number
  scope: 'all' | 'category'
  categoryKey?: string
  /** Admin: when scope=all, redraw only stale categories. Default false. */
  onlyStale?: boolean
}) {
  const onlyStale = input.onlyStale ?? false
  const settings = await loadSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((entry) => [entry.entryId, entry]))

  const draft = await prisma.bracketGeneration.findUnique({ where: { id: input.draftId } })
  if (!draft || draft.version !== input.expectedVersion) {
    const { VersionConflictError } = await import('../core/errors')
    throw new VersionConflictError()
  }

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: draft.id,
      ...(input.scope === 'category' && input.categoryKey
        ? { categoryKey: input.categoryKey }
        : {}),
    },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })

  let drawsToRedraw = draws
  if (onlyStale && input.scope === 'all') {
    drawsToRedraw = await filterStaleDraws(draws, eligible, eligibleMap, draft)
  }

  const plans = buildRedrawPlans({
    baseSeed: draft.baseSeed,
    draws: drawsToRedraw,
    eligibleMap,
  })

  const lockCategoryKeys =
    input.scope === 'category' && input.categoryKey ? [input.categoryKey] : undefined

  const result = await prisma.$transaction(async (tx) => {
    const { generation: lockedDraft } = await acquireBracketWriteLocks(tx, {
      scope: 'minimal',
      categoryKeys: lockCategoryKeys,
    })
    if (lockedDraft.id !== input.draftId) {
      throw new DraftConflictError()
    }
    if (lockedDraft.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    const drawBalanceReports: Record<
      string,
      import('../core/seeding/drawBalanceReport').DrawBalanceReport
    > = {}

    await applyRedrawPlansInTransaction(tx, plans)

    for (const plan of plans) {
      if (plan.balanceReport) {
        drawBalanceReports[plan.categoryKey] = plan.balanceReport
      }
    }

    await ensureLivePublicationPointers(tx, lockedDraft.id)

    await tx.bracketGeneration.update({
      where: { id: lockedDraft.id },
      data: { version: lockedDraft.version + 1 },
    })

    return {
      ok: true,
      draft: { id: lockedDraft.id, version: lockedDraft.version + 1 },
      warnings: [],
      drawBalanceReports,
    }
  }, BRACKET_MUTATION_TX_OPTIONS)

  const { computeDiffForDraft } = await import('../dashboardDiff')
  const diff = await computeDiffForDraft(result.draft.id)
  const drawBalanceReport =
    input.scope === 'category' && input.categoryKey
      ? result.drawBalanceReports[input.categoryKey]
      : undefined
  let category
  if (input.scope === 'category' && input.categoryKey) {
    const { buildCategoryCanonicalDto } = await import('../admin/categoryCanonical')
    category = await buildCategoryCanonicalDto(result.draft.id, input.categoryKey)
  }
  return { ...result, diff, drawBalanceReport, category }
}
