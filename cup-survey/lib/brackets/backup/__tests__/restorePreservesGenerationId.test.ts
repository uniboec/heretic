import { describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { createBracketBackup } from '../create'
import { restoreBracketBackup, computeRestoreImpact } from '../restore'
import { createImpactToken } from '../../live/impactToken'
import { requireWorkingGeneration } from '../../live/generation'
import { dbAvailable, useIntegrationDb } from '../../__tests__/integration/setup'
import {
  cleanupBracketIntegrationData,
  ensureBracketDefaults,
  preparePublishableDraft,
  resetRegistrationRevision,
} from '../../__tests__/integration/helpers'

describe('restorePreservesGenerationId', () => {
  useIntegrationDb()

  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []
  const backupIds: string[] = []

  it('keeps singleton generation id after restore commit', async () => {
    if (!dbAvailable) return

    await ensureBracketDefaults()
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const working = await requireWorkingGeneration()
    const { backup } = await createBracketBackup('generation-id-test')
    backupIds.push(backup.id)

    const impact = await prisma.$transaction((tx) => computeRestoreImpact(tx, backup.id))
    const impactToken = createImpactToken({
      version: 1,
      operation: 'restore_backup',
      mutationFingerprint: impact.mutationFingerprint,
      liveGenerationId: impact.liveGenerationId,
      liveGenerationVersion: impact.liveGenerationVersion,
      affectedCategoryKeys: impact.affectedCategoryKeys,
      lockLevels: impact.lockLevels,
    })

    const restored = await restoreBracketBackup({
      backupId: backup.id,
      expectedVersion: working.version,
      impactToken,
    })

    expect(restored.generation.id).toBe(working.id)

    await prisma.bracketBackup.deleteMany({ where: { id: { in: backupIds } } })
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    await resetRegistrationRevision()
  })
})
