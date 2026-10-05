import { afterEach, describe, expect, it } from 'vitest'
import { PublishValidationError } from '../../core/errors'
import { publishBracketDraft } from '../../generation/publish'
import { bumpRegistrationRevision } from '../../registrationRevision'
import {
  cleanupBracketIntegrationData,
  preparePublishableDraft,
  resetRegistrationRevision,
} from './helpers'
import { dbAvailable, useIntegrationDb } from './setup'

describe('brackets registration stale integration', () => {
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

  it('blocks publish with DRAFT_STALE when registration revision changes after SYNC', async () => {
    const prepared = await preparePublishableDraft()
    registrationIds.push(...prepared.registrationIds)
    entryIds.push(...prepared.entryIds)
    generationIds.push(prepared.originalDraftId)

    await bumpRegistrationRevision()

    try {
      await publishBracketDraft({
        draftId: prepared.draft.id,
        expectedVersion: prepared.draft.version,
      })
      expect.unreachable('publish should fail')
    } catch (error) {
      expect(error).toBeInstanceOf(PublishValidationError)
      const codes = (error as PublishValidationError).errors.map((e) => e.code)
      expect(codes).toContain('DRAFT_STALE')
    }
  })
})
