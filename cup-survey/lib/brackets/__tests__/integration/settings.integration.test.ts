import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { updateBracketFormatRules, updateBracketSettings } from '../../service'
import { VersionConflictError } from '../../core/errors'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  resetRegistrationRevision,
  seedTwoPaidEntriesDifferentClubs,
  syncRedrawAll,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets settings integration', () => {
  const generationIds: string[] = []
  const registrationIds: string[] = []
  const entryIds: string[] = []

  useIntegrationDb()

  afterEach(async () => {
    if (!dbAvailable) return
    await cleanupBracketIntegrationData({ generationIds, registrationIds, entryIds })
    generationIds.length = 0
    registrationIds.length = 0
    entryIds.length = 0
    await resetRegistrationRevision()
    await prisma.bracketPageSetting.update({
      where: { id: 'default' },
      data: { includePaid: true, includeUnpaid: false },
    })
  })

  it('PATCH settings eligibility change keeps fingerprints unchanged', async () => {
    const seeded = await seedTwoPaidEntriesDifferentClubs()
    registrationIds.push(...seeded.registrationIds)
    entryIds.push(...seeded.entryIds)

    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const ready = await syncRedrawAll(draft.id, draft.version)

    const before = await prisma.bracketGeneration.findUnique({
      where: { id: draft.id },
      include: { categories: true },
    })

    const result = await updateBracketSettings({
      includeUnpaid: true,
      draftId: draft.id,
      expectedVersion: ready.draft.version,
    })

    const after = await prisma.bracketGeneration.findUnique({
      where: { id: draft.id },
      include: { categories: true },
    })

    expect(result.settingsStale).toBe(true)
    expect(after!.sourceFingerprint).toBe(before!.sourceFingerprint)
    expect(after!.sourceRevision).toBe(before!.sourceRevision)
    for (const cat of before!.categories) {
      const updated = after!.categories.find((c) => c.categoryKey === cat.categoryKey)
      expect(updated?.sourceFingerprint).toBe(cat.sourceFingerprint)
      expect(updated?.seedingFingerprint).toBe(cat.seedingFingerprint)
    }
  })

  it('throws VERSION_CONFLICT on stale expectedVersion', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    await expect(
      updateBracketSettings({
        includeUnpaid: true,
        draftId: draft.id,
        expectedVersion: 99,
      }),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })

  it('throws VERSION_CONFLICT on format-rules PATCH with stale expectedVersion', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const rules = await prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })

    await expect(
      updateBracketFormatRules({
        draftId: draft.id,
        expectedVersion: 99,
        rules: rules.map((r) => ({
          id: r.id,
          minParticipants: r.minParticipants,
          maxParticipants: r.maxParticipants,
          systemId: r.systemId,
          defaultBronzeMode: r.defaultBronzeMode,
          allowedSystemIds: r.allowedSystemIds,
          sortOrder: r.sortOrder,
          enabled: r.enabled,
        })),
      }),
    ).rejects.toBeInstanceOf(VersionConflictError)
  })
})
