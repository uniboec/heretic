import { NextResponse } from 'next/server'
import { AwardsOperationError, AwardsPageSettingMissingError } from './errors'

export function awardsErrorResponse(error: unknown) {
  if (error instanceof AwardsOperationError) {
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: error.httpStatus },
    )
  }
  if (error instanceof AwardsPageSettingMissingError) {
    console.error('Awards settings missing', error)
    return NextResponse.json(
      { code: error.code, error: error.message },
      { status: 500 },
    )
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ error: 'Unknown error' }, { status: 500 })
}
