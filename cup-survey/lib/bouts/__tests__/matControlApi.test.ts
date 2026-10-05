import { describe, expect, it } from 'vitest'
import { ScheduleNumberConflictError } from '../errors'
import { matControlErrorResponse } from '../matControlApi'

describe('matControlErrorResponse', () => {
  it('returns schedule mutation replay errors with scheduleVersion', async () => {
    const response = matControlErrorResponse({
      success: false,
      mutationId: '11111111-1111-4111-8111-111111111111',
      code: 'BOUT_NOT_NEXT_IN_SCHEDULE',
      message: 'Поединок не является следующим в расписании',
      scheduleVersion: 12,
      replayed: true,
    })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toMatchObject({
      code: 'BOUT_NOT_NEXT_IN_SCHEDULE',
      scheduleVersion: 12,
      replayed: true,
    })
  })

  it('returns 422 for schedule number conflicts instead of 500', async () => {
    const response = matControlErrorResponse(
      new ScheduleNumberConflictError('Duplicate schedule number: 1-4'),
    )

    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body).toMatchObject({
      code: 'SCHEDULE_NUMBER_CONFLICT',
      error: 'Duplicate schedule number: 1-4',
    })
  })
})
