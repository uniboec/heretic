import type { Prisma } from '@prisma/client'
import { loadEligibleEntries } from '../core/eligibility'
import { buildVirtualComposition, buildConsolidationPlan } from './plan'
import { loadConsolidationAthleteContexts } from './eligibility'
import { normalizePolicy } from './policyHash'
import type { ConsolidationPlan, ConsolidationPolicy } from './types'

export async function loadConsolidationPlanContext(
  tx: Prisma.TransactionClient,
  input: {
    generationId: string
    policy: ConsolidationPolicy
  },
) {
  const settings =
    (await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })) ?? {
      includePaid: true,
      includeUnpaid: false,
    }

  const policy = normalizePolicy(input.policy)
  const formatRules = await tx.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })
  const eligible = await loadEligibleEntries(
    {
      includePaid: settings.includePaid,
      includeUnpaid: settings.includeUnpaid,
    },
    { tx },
  )

  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId: input.generationId },
    include: { participants: true },
  })
  const drawParticipantCounts = new Map(
    draws.map((draw) => [draw.categoryKey, draw.participants.length]),
  )

  const virtual = buildVirtualComposition(
    eligible.map((entry) => ({
      entryId: entry.entryId,
      effectiveCategoryKey: entry.effectiveCategoryKey,
    })),
  )
  const sourceByEntry = new Map(
    eligible.map((entry) => [entry.entryId, entry.sourceCategoryKey]),
  )
  const athleteContexts = await loadConsolidationAthleteContexts(eligible.map((entry) => entry.entryId))

  const plan = buildConsolidationPlan({
    policy,
    virtual,
    sourceByEntry,
    athleteContexts,
    formatRules,
    drawParticipantCounts,
  })

  return {
    policy,
    plan,
    eligible,
  }
}

export async function computeConsolidationPlan(
  tx: Prisma.TransactionClient,
  input: {
    generationId: string
    policy: ConsolidationPolicy
  },
): Promise<{
  plan: ConsolidationPlan
  policy: ConsolidationPolicy
}> {
  const context = await loadConsolidationPlanContext(tx, input)
  return {
    plan: context.plan,
    policy: context.policy,
  }
}
