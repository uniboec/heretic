import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { lockDraftForMutation } from '../../core/locks'
import { VersionConflictError } from '../../core/errors'
import { syncBracketDraft } from '../../generation/sync'
import { cleanupBracketIntegrationData, createIsolatedDraft } from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets locks integration', () => {
  const generationIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds })
    generationIds.length = 0
  })

  it('lockDraftForMutation throws VERSION_CONFLICT on stale expectedVersion', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await expect(
      prisma.$transaction((tx) => lockDraftForMutation(tx, draft.id, 99)),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })

  it('lockDraftForMutation throws GENERATION_NOT_DRAFT for published generation', async () => {
    const legacy = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'BracketGenerationStatus' AND e.enumlabel = 'PUBLISHED'
      ) AS exists
    `
    if (!legacy[0]?.exists) {
      return
    }

    const published = await prisma.bracketGeneration.create({
      data: {
        status: 'ACTIVE',
        singletonKey: `legacy-test-${Date.now()}`,
        baseSeed: 'seed',
        version: 1,
        publishedAt: new Date(),
      },
    })
    generationIds.push(published.id)

    await expect(
      prisma.$transaction((tx) => lockDraftForMutation(tx, published.id, 1)),
    ).rejects.toMatchObject({ code: 'GENERATION_NOT_DRAFT' })
  })

  it('sync scope=category returns GLOBAL_SYNC_REQUIRED when revision mismatches', async () => {
    await prisma.tournamentRegistrationState.update({
      where: { id: 'default' },
      data: { revision: BigInt(10) },
    })
    const draft = await createIsolatedDraft(BigInt(5))
    generationIds.push(draft.id)

    await expect(
      syncBracketDraft({
        draftId: draft.id,
        expectedVersion: 1,
        scope: 'category',
        categoryKey: 'tactic_control:beginner:m_juniors_1:w_66',
      }),
    ).rejects.toMatchObject({ code: 'GLOBAL_SYNC_REQUIRED' })
  })

  it('serializes concurrent mutations via version conflict', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const first = await prisma.$transaction(async (tx) => {
      const locked = await lockDraftForMutation(tx, draft.id, 1)
      await tx.bracketGeneration.update({
        where: { id: locked.id },
        data: { version: locked.version + 1 },
      })
      return locked.version + 1
    })
    expect(first).toBe(2)

    await expect(
      prisma.$transaction((tx) => lockDraftForMutation(tx, draft.id, 1)),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })
})
