import { NextResponse } from 'next/server'
import {
  DestructiveConfirmRequiredError,
  ImpactChangedError,
  ImpactTokenExpiredError,
  ImpactTokenInvalidError,
} from '../brackets/live/errors'

export function registrationImpactErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof DestructiveConfirmRequiredError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: 409 })
  }
  if (error instanceof ImpactChangedError) {
    return NextResponse.json(
      {
        code: error.code,
        error: error.message,
        actualImpact: error.actualImpact,
      },
      { status: 409 },
    )
  }
  if (error instanceof ImpactTokenInvalidError || error instanceof ImpactTokenExpiredError) {
    return NextResponse.json({ code: error.code, error: error.message }, { status: 409 })
  }
  return null
}
