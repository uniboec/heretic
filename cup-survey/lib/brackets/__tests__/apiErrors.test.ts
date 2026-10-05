import { describe, expect, it } from 'vitest'
import { bracketErrorResponse } from '../api'
import {
  BracketOperationError,
  DraftConflictError,
  PublishValidationError,
  VersionConflictError,
} from '../core/errors'
import {
  MatCountDemotionConfirmationRequiredError,
  ScheduleVersionConflictError,
} from '../../bouts/errors'

describe('bracketErrorResponse', () => {
  it('maps DraftConflictError to 409 DRAFT_ID_CONFLICT', async () => {
    const res = bracketErrorResponse(new DraftConflictError())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({
      code: 'DRAFT_ID_CONFLICT',
      error: 'Черновик не найден или не в статусе «Черновик»',
    })
  })

  it('maps VersionConflictError to 409 VERSION_CONFLICT', async () => {
    const res = bracketErrorResponse(new VersionConflictError())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('VERSION_CONFLICT')
  })

  it('maps PublishValidationError to 422 with errors array', async () => {
    const res = bracketErrorResponse(
      new PublishValidationError([{ code: 'DRAFT_STALE', message: 'stale' }]),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors[0].code).toBe('DRAFT_STALE')
  })

  it('maps BracketOperationError to 422', async () => {
    const res = bracketErrorResponse(new BracketOperationError('GLOBAL_SYNC_REQUIRED', 'sync all'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors[0].code).toBe('GLOBAL_SYNC_REQUIRED')
  })

  it('maps ScheduleVersionConflictError to 409 SCHEDULE_VERSION_CONFLICT', async () => {
    const res = bracketErrorResponse(new ScheduleVersionConflictError())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('SCHEDULE_VERSION_CONFLICT')
  })

  it('maps MatCountDemotionConfirmationRequiredError to 409 with error envelope', async () => {
    const res = bracketErrorResponse(
      new MatCountDemotionConfirmationRequiredError({
        demotionToken: 'token-abc',
        demotedFixedMats: [3],
        demotedCategoryCount: 1,
        draftEntries: [{ categoryKey: 'cat-a', matIndex: 3 }],
        publishedEntries: [],
      }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body).toEqual({
      error: 'Требуется подтверждение перевода Fixed-категорий в Auto',
      code: 'MAT_COUNT_DEMOTION_CONFIRMATION_REQUIRED',
      demotionToken: 'token-abc',
      demotedFixedMats: [3],
      demotedCategoryCount: 1,
      draftEntries: [{ categoryKey: 'cat-a', matIndex: 3 }],
      publishedEntries: [],
    })
  })
})
