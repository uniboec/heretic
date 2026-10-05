import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../../prisma'
import { PublishValidationError } from '../../core/errors'
import { lockDraftForMutation } from '../../core/locks'
import { bumpRegistrationRevision } from '../../registrationRevision'
import { publishBracketDraft } from '../../generation/publish'
import { redrawBracketDraft } from '../../generation/redraw'
import { syncBracketDraft } from '../../generation/sync'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets publish integration', () => {
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
  })

  it('publish bumps version in-place on ACTIVE singleton and freezes snapshots', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const result = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })

    expect(result.draft.id).toBe(prepared.draft.id)
    expect(result.publishedGenerationId).toBe(prepared.draft.id)
    expect(result.draft.version).toBe(prepared.draft.version + 1)

    const published = await prisma.bracketGeneration.findUnique({
      where: { id: result.publishedGenerationId },
      include: { categories: { include: { participants: true } } },
    })

    expect(published?.status).toBe('ACTIVE')
    expect(published?.singletonKey).toBe('live')
    expect(
      published?.categories.some((c) =>
        c.participants.some((p) => p.snapshotDisplayName != null),
      ),
    ).toBe(true)
    expect(published?.categories.some((c) => c.systemVersion != null)).toBe(true)
  })

  it('mutating the same ACTIVE generation after publish remains allowed', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const published = await publishBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
    })

    const locked = await prisma.$transaction((tx) =>
      lockDraftForMutation(tx, published.publishedGenerationId, published.draft.version),
    )
    expect(locked.id).toBe(published.publishedGenerationId)

    const synced = await syncBracketDraft({
      draftId: published.draft.id,
      expectedVersion: published.draft.version,
      scope: 'all',
    })
    expect(synced.draft.version).toBeGreaterThan(published.draft.version)
  })

  it('club change: revision++ blocks publish until SYNC then REDRAW', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    await prisma.teamRegistration.update({
      where: { id: prepared.registrationIds[0] },
      data: { clubName: 'Changed Club Name' },
    })
    await bumpRegistrationRevision()

    await expect(
      publishBracketDraft({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
      }),
    ).rejects.toBeInstanceOf(PublishValidationError)

    const synced = await syncBracketDraft({
      draftId: prepared.draft.id,
      expectedVersion: prepared.draft.version,
      scope: 'all',
    })

    try {
      await publishBracketDraft({
        draftId: synced.draft.id,
        expectedVersion: synced.draft.version,
      })
      expect.unreachable('publish should fail with SEEDING_STALE')
    } catch (error) {
      expect(error).toBeInstanceOf(PublishValidationError)
      const codes = (error as PublishValidationError).errors.map((e) => e.code)
      expect(codes).toContain('SEEDING_STALE')
    }

    const redrawn = await redrawBracketDraft({
      draftId: synced.draft.id,
      expectedVersion: synced.draft.version,
      scope: 'all',
    })

    const ok = await publishBracketDraft({
      draftId: redrawn.draft.id,
      expectedVersion: redrawn.draft.version,
    })
    expect(ok.draft.id).toBe(prepared.draft.id)
    expect(ok.draft.version).toBeGreaterThan(redrawn.draft.version)
  })
})
