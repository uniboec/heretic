import type { Prisma } from '@prisma/client'
import { ImpactChangedError } from './errors'
import type { BracketImpactResult } from './impact'
import { impactMatches, verifyImpactToken, type ImpactTokenOperation } from './impactToken'

export async function verifyImpactTokenUnderLock(
  tx: Prisma.TransactionClient,
  input: {
    impactToken: string
    expectedOperation: ImpactTokenOperation
    registrationId?: string
    computeActual: (tx: Prisma.TransactionClient) => Promise<BracketImpactResult>
  },
): Promise<BracketImpactResult> {
  const tokenPayload = verifyImpactToken(input.impactToken)
  const actual = await input.computeActual(tx)

  if (
    !impactMatches(tokenPayload, {
      operation: input.expectedOperation,
      registrationId: input.registrationId,
      mutationFingerprint: actual.mutationFingerprint,
      liveGenerationId: actual.liveGenerationId,
      liveGenerationVersion: actual.liveGenerationVersion,
      affectedCategoryKeys: actual.affectedCategoryKeys,
      lockLevels: actual.lockLevels,
    })
  ) {
    throw new ImpactChangedError({
      affectedCategoryKeys: actual.affectedCategoryKeys,
      lockLevels: actual.lockLevels,
    })
  }

  return actual
}

export function requiresDestructiveConfirm(
  lockLevels: Record<string, string>,
): boolean {
  return Object.values(lockLevels).some((level) => level !== 'OPEN')
}
