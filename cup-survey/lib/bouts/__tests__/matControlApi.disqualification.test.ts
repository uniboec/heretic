import { describe, expect, it } from 'vitest'
import { DisqualificationConfirmationRequiredError } from '../mat-control/errors'
import { matControlErrorResponse } from '../matControlApi'

describe('matControlApi disqualification errors', () => {
  it('maps DisqualificationConfirmationRequiredError to HTTP 409', async () => {
    const response = matControlErrorResponse(
      new DisqualificationConfirmationRequiredError('Требуется подтверждение'),
    )
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).toBe('DISQUALIFICATION_CONFIRMATION_REQUIRED')
  })
})
