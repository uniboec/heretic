import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { VersionConflictError } from '../core/errors'
import { computeImpactForConsolidation } from './impact'
import { DestructiveConfirmRequiredError, ImpactChangedError } from '../live/errors'
import { impactMatches, verifyImpactToken } from '../live/impactToken'
import { acquireBracketWriteLocks } from '../live/locks'
import { forceRebuildCategories } from '../live/forceRebuild'
import { computeConsolidationPlan, loadConsolidationPlanContext } from './context'
import { hashPlan } from './planFingerprint'
import {
  assertPlanTokenMatches,
  verifyConsolidationPlanToken,
} from './planToken'
import type { ConsolidationPlan, ConsolidationPolicy } from './types'

function traceForEntry(plan: ConsolidationPlan, entryId: string) {
  return plan.trace.filter((hop) => hop.entryIds.includes(entryId))
}

function requiresImpactConfirmation(
  lockLevels: Record<string, import('../live/guard').CategoryLockLevel>,
): boolean {
  return Object.values(lockLevels).some((level) => level === 'RELEASED' || level === 'PLAYED')
}

export async function applyConsolidation(input: {
  expectedVersion: number
  policy: ConsolidationPolicy
  consolidationPlanToken: string
  impactToken?: string
  movedBy?: string
}) {
  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'destructive_admin',
    })

    if (ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    const { plan, policy } = await computeConsolidationPlan(tx, {
      generationId: ctx.generation.id,
      policy: input.policy,
    })

    const tokenPayload = verifyConsolidationPlanToken(input.consolidationPlanToken)

    assertPlanTokenMatches({
      token: tokenPayload,
      generationId: ctx.generation.id,
      generationVersion: ctx.generation.version,
      policy,
      plan,
    })

    const impact = await computeImpactForConsolidation(tx, plan)
    const needsImpact = requiresImpactConfirmation(impact.lockLevels)

    if (needsImpact) {
      if (!input.impactToken) {
        throw new DestructiveConfirmRequiredError()
      }
      const impactTokenPayload = verifyImpactToken(input.impactToken)
      if (
        !impactMatches(impactTokenPayload, {
          operation: 'consolidation',
          mutationFingerprint: impact.mutationFingerprint,
          liveGenerationId: impact.liveGenerationId,
          liveGenerationVersion: impact.liveGenerationVersion,
          affectedCategoryKeys: impact.affectedCategoryKeys,
          lockLevels: impact.lockLevels,
        })
      ) {
        throw new ImpactChangedError({
          affectedCategoryKeys: impact.affectedCategoryKeys,
          lockLevels: impact.lockLevels,
        })
      }
    }

    for (const placement of plan.finalPlacements) {
      await tx.bracketEntryPlacement.upsert({
        where: { entryId: placement.entryId },
        create: {
          entryId: placement.entryId,
          categoryKey: placement.finalCategoryKey,
          isManualMove: false,
          movedAt: new Date(),
        },
        update: {
          categoryKey: placement.finalCategoryKey,
          isManualMove: false,
          movedAt: new Date(),
        },
      })

      await tx.bracketMoveAudit.create({
        data: {
          entryId: placement.entryId,
          action: 'CONSOLIDATION',
          fromCategoryKey: placement.fromCategoryKey,
          toCategoryKey: placement.finalCategoryKey,
          movedBy: input.movedBy ?? null,
          metadata: {
            trace: traceForEntry(plan, placement.entryId),
            planFingerprint: hashPlan(plan),
          },
        },
      })
    }

    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: plan.affectedCategoryKeys,
      preserveVisible: true,
    })

    const updated = await tx.bracketGeneration.update({
      where: { id: ctx.generation.id },
      data: { version: ctx.generation.version + 1 },
    })

    return {
      ok: true as const,
      draft: { id: updated.id, version: updated.version },
      planFingerprint: hashPlan(plan),
      affectedCategoryKeys: plan.affectedCategoryKeys,
      movedCount: plan.finalPlacements.length,
    }
  })
}

export async function previewConsolidation(input: {
  expectedVersion: number
  policy: ConsolidationPolicy
}) {
  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, { scope: 'minimal' })
    if (ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    const { plan, policy, eligible } = await loadConsolidationPlanContext(tx, {
      generationId: ctx.generation.id,
      policy: input.policy,
    })

    const relevantEntryIds = new Set<string>()
    for (const placement of plan.finalPlacements) {
      relevantEntryIds.add(placement.entryId)
    }
    for (const hop of plan.trace) {
      for (const entryId of hop.entryIds) {
        relevantEntryIds.add(entryId)
      }
    }
    for (const item of plan.skipped) {
      for (const entryId of item.entryIds ?? []) {
        relevantEntryIds.add(entryId)
      }
    }

    const entries = eligible
      .filter((entry) => relevantEntryIds.has(entry.entryId))
      .map((entry) => ({
        entryId: entry.entryId,
        displayName: entry.displayName,
        clubName: entry.clubName,
        city: entry.city,
        publicNumber: entry.publicNumber,
      }))

    const { createConsolidationPlanToken } = await import('./planToken')
    const consolidationPlanToken = createConsolidationPlanToken({
      generationId: ctx.generation.id,
      generationVersion: ctx.generation.version,
      policy,
      plan,
    })

    const impact = await computeImpactForConsolidation(tx, plan)
    const needsImpact = requiresImpactConfirmation(impact.lockLevels)

    let impactToken: string | undefined
    if (needsImpact) {
      const { createImpactToken } = await import('../live/impactToken')
      impactToken = createImpactToken({
        version: 1,
        operation: 'consolidation',
        mutationFingerprint: impact.mutationFingerprint,
        liveGenerationId: impact.liveGenerationId,
        liveGenerationVersion: impact.liveGenerationVersion,
        affectedCategoryKeys: impact.affectedCategoryKeys,
        lockLevels: impact.lockLevels,
      })
    }

    const totalCategoryCount = await tx.bracketCategoryDraw.count({
      where: { generationId: ctx.generation.id },
    })

    return {
      ok: true as const,
      plan,
      policy,
      entries,
      consolidationPlanToken,
      impactToken,
      impact: needsImpact
        ? {
            affectedCategoryKeys: impact.affectedCategoryKeys,
            lockLevels: impact.lockLevels,
            totalCategoryCount,
          }
        : undefined,
      draft: { id: ctx.generation.id, version: ctx.generation.version },
    }
  })
}
