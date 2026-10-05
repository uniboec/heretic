import type { BracketCategoryDraw, BracketPublicationState, Prisma } from '@prisma/client'
import { lockBoutsPageSetting } from '../../bouts/locks'
import { lockRegistrationState } from '../core/locks'
import {
  lockLiveGeneration,
  lockWorkingDraftGeneration,
  type WorkingGeneration,
} from './generation'

export type BracketWriteLockScope = 'minimal' | 'destructive_admin' | 'cutover'

export interface BracketWriteLockContext {
  boutsSettings: Awaited<ReturnType<typeof lockBoutsPageSetting>>
  registrationState: { id: string; revision: bigint }
  generation: WorkingGeneration
  draws: BracketCategoryDraw[]
  publicationStates: BracketPublicationState[]
}

async function lockCategoryDraws(
  tx: Prisma.TransactionClient,
  generationId: string,
  categoryKeys?: string[],
): Promise<BracketCategoryDraw[]> {
  if (categoryKeys?.length) {
    const sorted = [...new Set(categoryKeys)].sort()
    const rows: BracketCategoryDraw[] = []
    for (const categoryKey of sorted) {
      const locked = await tx.$queryRaw<BracketCategoryDraw[]>`
        SELECT * FROM "BracketCategoryDraw"
        WHERE "generationId" = ${generationId} AND "categoryKey" = ${categoryKey}
        FOR UPDATE
      `
      if (locked[0]) rows.push(locked[0])
    }
    return rows
  }

  return tx.$queryRaw<BracketCategoryDraw[]>`
    SELECT * FROM "BracketCategoryDraw"
    WHERE "generationId" = ${generationId}
    ORDER BY "categoryKey" ASC
    FOR UPDATE
  `
}

async function lockPublicationStates(
  tx: Prisma.TransactionClient,
  categoryKeys?: string[],
): Promise<BracketPublicationState[]> {
  if (categoryKeys?.length) {
    const sorted = [...new Set(categoryKeys)].sort()
    const rows: BracketPublicationState[] = []
    for (const categoryKey of sorted) {
      const locked = await tx.$queryRaw<BracketPublicationState[]>`
        SELECT * FROM "BracketPublicationState"
        WHERE "categoryKey" = ${categoryKey}
        FOR UPDATE
      `
      if (locked[0]) rows.push(locked[0])
    }
    return rows
  }

  return tx.$queryRaw<BracketPublicationState[]>`
    SELECT * FROM "BracketPublicationState"
    ORDER BY "categoryKey" ASC
    FOR UPDATE
  `
}

/**
 * Canonical lock prefix for all bracket/bouts writers.
 * Steps may be skipped but order must not change.
 */
export async function acquireBracketWriteLocks(
  tx: Prisma.TransactionClient,
  input: {
    scope: BracketWriteLockScope
    categoryKeys?: string[]
    useLiveSingleton?: boolean
  },
): Promise<BracketWriteLockContext> {
  const boutsSettings = await lockBoutsPageSetting(tx)
  const registrationState = await lockRegistrationState(tx)

  const generation = input.useLiveSingleton
    ? await lockLiveGeneration(tx)
    : (await lockWorkingDraftGeneration(tx)) ??
      (await lockLiveGeneration(tx).catch(() => null))

  if (!generation) {
    throw new Error('No working bracket generation to lock')
  }

  const drawKeys =
    input.scope === 'destructive_admin' || input.scope === 'cutover'
      ? undefined
      : input.categoryKeys

  const pubKeys =
    input.scope === 'destructive_admin' || input.scope === 'cutover'
      ? undefined
      : input.categoryKeys

  const draws = await lockCategoryDraws(tx, generation.id, drawKeys)
  const publicationStates = await lockPublicationStates(tx, pubKeys)

  return {
    boutsSettings,
    registrationState,
    generation,
    draws,
    publicationStates,
  }
}
