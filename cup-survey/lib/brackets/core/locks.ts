import type { BracketGeneration, Prisma } from '@prisma/client'
import { lockWorkingDraftGeneration } from '../live/generation'
import { assertWorkingGeneration } from './assertWorkingGeneration'
import { DraftConflictError, VersionConflictError } from './errors'

export async function lockActiveDraftGeneration(
  tx: Prisma.TransactionClient,
): Promise<BracketGeneration | null> {
  return lockWorkingDraftGeneration(tx)
}

export async function lockRegistrationState(
  tx: Prisma.TransactionClient,
): Promise<{ id: string; revision: bigint }> {
  const rows = await tx.$queryRaw<Array<{ id: string; revision: bigint }>>`
    SELECT id, revision FROM "TournamentRegistrationState" WHERE id = 'default' FOR UPDATE
  `
  const row = rows[0]
  if (!row) {
    await tx.tournamentRegistrationState.create({ data: { id: 'default', revision: 0 } })
    return { id: 'default', revision: BigInt(0) }
  }
  return row
}

export async function incrementRegistrationRevision(tx: Prisma.TransactionClient): Promise<bigint> {
  const state = await lockRegistrationState(tx)
  const updated = await tx.tournamentRegistrationState.update({
    where: { id: state.id },
    data: { revision: { increment: 1 } },
  })
  return updated.revision
}

export async function lockDraftForMutation(
  tx: Prisma.TransactionClient,
  draftId: string,
  expectedVersion: number,
): Promise<BracketGeneration> {
  const rows = await tx.$queryRaw<BracketGeneration[]>`
    SELECT * FROM "BracketGeneration" WHERE id = ${draftId} FOR UPDATE
  `
  const draft = rows[0]
  if (!draft) {
    throw new DraftConflictError()
  }
  assertWorkingGeneration(draft)
  if (draft.version !== expectedVersion) {
    throw new VersionConflictError()
  }
  return draft
}
