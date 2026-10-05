import type { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { VersionConflictError } from '../core/errors'
import { BRACKET_MUTATION_TX_OPTIONS } from '../core/transactionOptions'
import { ImpactChangedError } from './errors'
import { computeImpactForReset } from './impact'
import { impactMatches, verifyImpactToken } from './impactToken'
import { assertResetAllowed } from './guard'
import { acquireBracketWriteLocks, type BracketWriteLockContext } from './locks'

export async function resetLiveBrackets(
  tx: Prisma.TransactionClient,
  ctx: BracketWriteLockContext,
): Promise<void> {
  assertResetAllowed(ctx.publicationStates)

  const generationId = ctx.generation.id
  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId },
    select: { id: true },
  })

  for (const draw of draws) {
    const publicationState = await tx.bracketPublicationState.findFirst({
      where: { publishedDrawId: draw.id },
    })
    if (publicationState) {
      await tx.bracketPublicationState.delete({ where: { id: publicationState.id } })
    }
  }

  await tx.bracketEntryPlacement.deleteMany()
  await tx.bracketCategoryDraw.deleteMany({ where: { generationId } })

  await tx.bracketGeneration.update({
    where: { id: generationId },
    data: { version: ctx.generation.version + 1 },
  })
}

export async function resetLiveBracketsStandalone(input: {
  expectedVersion: number
  impactToken: string
}): Promise<{ ok: true; generation: { id: string; version: number } }> {
  return prisma.$transaction(async (tx) => {
    const ctx = await acquireBracketWriteLocks(tx, {
      scope: 'destructive_admin',
    })

    if (ctx.generation.version !== input.expectedVersion) {
      throw new VersionConflictError()
    }

    const tokenPayload = verifyImpactToken(input.impactToken)
    const actualImpact = await computeImpactForReset(tx)
    if (
      !impactMatches(tokenPayload, {
        operation: 'reset_live',
        mutationFingerprint: actualImpact.mutationFingerprint,
        liveGenerationId: actualImpact.liveGenerationId,
        liveGenerationVersion: actualImpact.liveGenerationVersion,
        affectedCategoryKeys: actualImpact.affectedCategoryKeys,
        lockLevels: actualImpact.lockLevels,
      })
    ) {
      throw new ImpactChangedError({
        affectedCategoryKeys: actualImpact.affectedCategoryKeys,
        lockLevels: actualImpact.lockLevels,
      })
    }

    await resetLiveBrackets(tx, ctx)

    const updated = await tx.bracketGeneration.findUniqueOrThrow({
      where: { id: ctx.generation.id },
    })

    return {
      ok: true,
      generation: { id: updated.id, version: updated.version },
    }
  }, BRACKET_MUTATION_TX_OPTIONS)
}
