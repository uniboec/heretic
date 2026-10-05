import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../../prisma'
import {
  cleanupBracketIntegrationData,
  createIsolatedDraft,
  preparePublishableDraft,
  resetRegistrationRevision,
  seedBoutsPageSetting,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

vi.mock('@/lib/auth', () => ({
  verifyAdminSession: vi.fn().mockResolvedValue(true),
}))

import { publishBracketDraft } from '../../generation/publish'
import { POST as publishPost } from '@/app/api/admin/brackets/publish/route'
import { POST as boutsReleasePost } from '@/app/api/admin/brackets/bouts-release/route'
import { PATCH as settingsPatch } from '@/app/api/admin/brackets/settings/route'
import { PATCH as formatRulesPatch } from '@/app/api/admin/brackets/format-rules/route'

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('brackets admin API routes integration', () => {
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

  it('POST /publish returns 410 PUBLISH_REMOVED', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const res = await publishPost(
      jsonRequest('http://localhost/api/admin/brackets/publish', {
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version + 100,
      }),
    )

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe('PUBLISH_REMOVED')
  })

  it('PATCH /settings returns 409 VERSION_CONFLICT on stale expectedVersion', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)

    const res = await settingsPatch(
      new Request('http://localhost/api/admin/brackets/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includeUnpaid: true,
          draftId: draft.id,
          expectedVersion: 99,
        }),
      }),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('VERSION_CONFLICT')
  })

  it('PATCH /format-rules returns 409 VERSION_CONFLICT on stale expectedVersion', async () => {
    const draft = await createIsolatedDraft()
    generationIds.push(draft.id)
    const rules = await prisma.bracketFormatRule.findMany({ orderBy: { sortOrder: 'asc' } })

    const res = await formatRulesPatch(
      new Request('http://localhost/api/admin/brackets/format-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      }),
    )

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('VERSION_CONFLICT')
  })

  it('POST /publish returns 410 PUBLISH_REMOVED after registration cancel simulation', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    const cancelledId = prepared.registrationIds[0]
    await prisma.teamRegistration.delete({ where: { id: cancelledId } })
    registrationIds.splice(registrationIds.indexOf(cancelledId), 1)
    entryIds.splice(0, 1)

    const { bumpRegistrationRevision } = await import('../../registrationRevision')
    await bumpRegistrationRevision()

    const res = await publishPost(
      jsonRequest('http://localhost/api/admin/brackets/publish', {
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
      }),
    )

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.code).toBe('PUBLISH_REMOVED')
  })

  it('POST /bouts-release releases ready category in Phase 2', async () => {
    vi.stubEnv('INDEPENDENT_BOUTS_RELEASE', 'true')
    await seedBoutsPageSetting()

    try {
      const prepared = await preparePublishableDraft()
      registrationIds.push(...prepared.registrationIds)
      entryIds.push(...prepared.entryIds)
      generationIds.push(prepared.originalDraftId)

      const publishBody = await publishBracketDraft({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
      })
      generationIds.push(publishBody.publishedGenerationId, publishBody.draft.id)

      const draw = await prisma.bracketCategoryDraw.findFirst({
        where: { generationId: publishBody.publishedGenerationId, status: 'ACTIVE' },
      })
      expect(draw).not.toBeNull()

      const res = await boutsReleasePost(
        jsonRequest('http://localhost/api/admin/brackets/bouts-release', {
          scope: 'category',
          categoryKey: draw!.categoryKey,
          released: true,
          expectedPublishedDrawId: draw!.id,
          expectedPublishedGenerationId: publishBody.publishedGenerationId,
        }),
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)

      const state = await prisma.bracketPublicationState.findUnique({
        where: { categoryKey: draw!.categoryKey },
      })
      expect(state?.boutsReleased).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
