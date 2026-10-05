import type { BracketGeneration, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '../../prisma'
import { LIVE_GENERATION_SINGLETON_KEY } from '../bracketConstants'
import { LiveGenerationMissingError } from './errors'

export type WorkingGeneration = BracketGeneration

export async function getLiveGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WorkingGeneration> {
  const row = await client.bracketGeneration.findFirst({
    where: { singletonKey: LIVE_GENERATION_SINGLETON_KEY, status: 'ACTIVE' },
  })
  if (!row) {
    throw new LiveGenerationMissingError()
  }
  return row
}

export async function findLiveGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WorkingGeneration | null> {
  return client.bracketGeneration.findFirst({
    where: { singletonKey: LIVE_GENERATION_SINGLETON_KEY, status: 'ACTIVE' },
  })
}

/** Bootstrap / dev / cutover only — not for ordinary request handlers post-cutover. */
export async function ensureLiveGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ id: string; version: number }> {
  const existing = await findLiveGeneration(client)
  if (existing) return { id: existing.id, version: existing.version }

  const created = await client.bracketGeneration.create({
    data: {
      status: 'ACTIVE',
      singletonKey: LIVE_GENERATION_SINGLETON_KEY,
      baseSeed: randomUUID(),
      version: 1,
    },
  })
  return { id: created.id, version: created.version }
}

/** Working generation for mutations (ACTIVE singleton). */
export async function resolveWorkingDraftGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WorkingGeneration | null> {
  return findLiveGeneration(client)
}

/** Public/bouts source generation (ACTIVE singleton). */
export async function resolvePublicGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WorkingGeneration | null> {
  return findLiveGeneration(client)
}

export async function lockLiveGeneration(
  tx: Prisma.TransactionClient,
): Promise<WorkingGeneration> {
  const rows = await tx.$queryRaw<WorkingGeneration[]>`
    SELECT * FROM "BracketGeneration"
    WHERE "singletonKey" = ${LIVE_GENERATION_SINGLETON_KEY}
    FOR UPDATE
  `
  const row = rows[0]
  if (!row) {
    throw new LiveGenerationMissingError()
  }
  return row
}

export async function requireWorkingGeneration(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WorkingGeneration> {
  const row = await resolveWorkingDraftGeneration(client)
  if (!row) {
    throw new LiveGenerationMissingError()
  }
  return row
}

export async function lockWorkingDraftGeneration(
  tx: Prisma.TransactionClient,
): Promise<WorkingGeneration | null> {
  try {
    return await lockLiveGeneration(tx)
  } catch {
    return null
  }
}
