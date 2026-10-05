import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { incrementRegistrationRevision } from '../brackets/core/locks'
import { acquireBracketWriteLocks } from '../brackets/live/locks'
import { computeImpactForRegistrationMutation } from '../brackets/live/impact'
import { verifyImpactTokenUnderLock, requiresDestructiveConfirm } from '../brackets/live/commitImpact'
import { DestructiveConfirmRequiredError } from '../brackets/live/errors'
import { forceRebuildCategories } from '../brackets/live/forceRebuild'
import { autoSyncCategoryKeysForRegistrationChange } from '../brackets/live/policyD'
import { autoSyncBracketDraftForRegistrationChange } from './bracketAutoSync'
import { BRACKET_MUTATION_TX_OPTIONS } from '../brackets/core/transactionOptions'

export type BracketImpactCommitOptions = {
  impactToken?: string
  registrationId?: string
  mutationFingerprint?: string
  categoryKeys?: string[]
  entryIds?: string[]
}

export async function bumpRegistrationRevisionInTransaction(
  tx?: Prisma.TransactionClient,
): Promise<bigint> {
  if (tx) {
    return incrementRegistrationRevision(tx)
  }
  return prisma.$transaction(async (innerTx) => incrementRegistrationRevision(innerTx))
}

/** Post-commit sync after registration revision bump. Never throws to caller. */
export async function runPostCommitBracketSync(
  categoryKeys?: string[],
): Promise<void> {
  try {
    await autoSyncBracketDraftForRegistrationChange(categoryKeys)
  } catch (error) {
    console.error('runPostCommitBracketSync failed', error)
  }
}

async function commitRegistrationImpactInTx<T>(
  tx: Prisma.TransactionClient,
  options: BracketImpactCommitOptions,
  runMutation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!options.impactToken || !options.registrationId || !options.mutationFingerprint) {
    throw new DestructiveConfirmRequiredError()
  }

  const ctx = await acquireBracketWriteLocks(tx, { scope: 'destructive_admin' })
  const actual = await verifyImpactTokenUnderLock(tx, {
    impactToken: options.impactToken,
    expectedOperation: 'admin_registration_mutation',
    registrationId: options.registrationId,
    computeActual: (innerTx) =>
      computeImpactForRegistrationMutation(
        innerTx,
        options.registrationId!,
        options.mutationFingerprint!,
        options.categoryKeys ?? [],
        options.entryIds?.length ? { entryIds: options.entryIds } : undefined,
      ),
  })

  const result = await runMutation(tx)

  await incrementRegistrationRevision(tx)

  if (actual.affectedCategoryKeys.length > 0) {
    await forceRebuildCategories(tx, {
      generationId: ctx.generation.id,
      categoryKeys: actual.affectedCategoryKeys,
      preserveVisible: true,
    })
  }

  await tx.bracketGeneration.update({
    where: { id: ctx.generation.id },
    data: { version: ctx.generation.version + 1 },
  })

  return result
}

async function commitRegistrationImpact(
  options: BracketImpactCommitOptions,
): Promise<void> {
  await prisma.$transaction(
    async (tx) => commitRegistrationImpactInTx(tx, options, async () => undefined),
    BRACKET_MUTATION_TX_OPTIONS,
  )
}

async function previewRegistrationImpact(options: BracketImpactCommitOptions) {
  if (!options.registrationId || !options.mutationFingerprint) return null
  const { resolveWorkingDraftGeneration } = await import('../brackets/live/generation')
  const workingGeneration = await resolveWorkingDraftGeneration()
  if (!workingGeneration) return null

  return prisma.$transaction((tx) =>
    computeImpactForRegistrationMutation(
      tx,
      options.registrationId!,
      options.mutationFingerprint!,
      options.categoryKeys ?? [],
      options.entryIds?.length ? { entryIds: options.entryIds } : undefined,
    ),
  )
}

/** Coordinator entry: run mutation, then sync or atomic impact commit. */
export async function withBracketImpactAfterCommit<T>(
  runMutation: (tx?: Prisma.TransactionClient) => Promise<T>,
  options?: BracketImpactCommitOptions,
): Promise<T> {
  if (options?.impactToken) {
    return prisma.$transaction(
      async (tx) => commitRegistrationImpactInTx(tx, options, (innerTx) => runMutation(innerTx)),
      BRACKET_MUTATION_TX_OPTIONS,
    )
  }

  const preview = await previewRegistrationImpact(options ?? {})
  if (preview && requiresDestructiveConfirm(preview.lockLevels)) {
    throw new DestructiveConfirmRequiredError()
  }

  const result = await runMutation()
  await bumpRegistrationRevisionInTransaction()
  await runPostCommitBracketSync(options?.categoryKeys)
  return result
}
