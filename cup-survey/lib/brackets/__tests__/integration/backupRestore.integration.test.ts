import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { createBracketBackup } from '../../backup/create'
import { restoreBracketBackup } from '../../backup/restore'
import { computeRestoreImpact } from '../../backup/restore'
import { createImpactToken } from '../../live/impactToken'
import {
  cleanupBracketIntegrationData,
  ensureBracketDefaults,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('backup restore integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []
  const backupIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    if (backupIds.length > 0) {
      await prisma.bracketBackup.deleteMany({ where: { id: { in: backupIds } } })
      backupIds.length = 0
    }
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
  })

  it('creates structure backup and restores under impact token without changing generation id', async () => {
    await ensureBracketDefaults()
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const before = await prisma.bracketGeneration.findUniqueOrThrow({
      where: { id: prepared.draft.id },
    })

    const { backup } = await createBracketBackup('integration-restore')
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
      expectedVersion: before.version,
      impactToken,
    })

    expect(restored.generation.id).toBe(before.id)
    expect(restored.generation.version).toBe(before.version + 1)

    const after = await prisma.bracketGeneration.findUniqueOrThrow({
      where: { id: before.id },
    })
    expect(after.id).toBe(before.id)
  })
})
