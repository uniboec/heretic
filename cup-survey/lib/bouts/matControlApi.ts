import { NextResponse } from 'next/server'
import { BoutsSchedulerError, BoutsValidationError } from './errors'
import { CorrectionBlockedError, MatControlError } from './mat-control/errors'
import type { ScheduleMutationErrorResponse } from './scheduleMutation'
import { NO_STORE_HEADERS } from './routeSegmentConfig'

function isScheduleMutationErrorResponse(error: unknown): error is ScheduleMutationErrorResponse {
  return (
    typeof error === 'object' &&
    error != null &&
    (error as ScheduleMutationErrorResponse).success === false &&
    typeof (error as ScheduleMutationErrorResponse).code === 'string'
  )
}

export function matControlErrorResponse(error: unknown) {
  if (isScheduleMutationErrorResponse(error)) {
    const status =
      error.code === 'SCHEDULE_VERSION_CONFLICT' || error.code === 'BOUT_NOT_NEXT_IN_SCHEDULE'
        ? 409
        : 422
    return NextResponse.json(error, { status, headers: NO_STORE_HEADERS })
  }
  if (error instanceof CorrectionBlockedError) {
    return NextResponse.json(
      {
        code: error.code,
        error: error.message,
        blockingBoutIds: error.blockingBoutIds,
      },
      { status: error.httpStatus, headers: NO_STORE_HEADERS },
    )
  }

  if (error instanceof BoutsValidationError) {
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: 400, headers: NO_STORE_HEADERS },
    )
  }

  if (error instanceof BoutsSchedulerError) {
    const status =
      error.code === 'SCHEDULE_VERSION_CONFLICT' || error.code === 'BOUT_NOT_NEXT_IN_SCHEDULE'
        ? 409
        : 422
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status, headers: NO_STORE_HEADERS },
    )
  }

  if (error instanceof MatControlError) {
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: error.httpStatus, headers: NO_STORE_HEADERS },
    )
  }

  console.error('Mat control API error', error)
  const message = error instanceof Error ? error.message : 'Internal server error'
  return NextResponse.json(
    { error: message },
    { status: 500, headers: NO_STORE_HEADERS },
  )
}

export function matControlJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}
