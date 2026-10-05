import { NextResponse } from 'next/server'

const GENERIC_ERROR_MESSAGE = 'Ошибка сервера'

export function apiErrorResponse(error: unknown): NextResponse {
  console.error('API error', error)
  return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 })
}

export { GENERIC_ERROR_MESSAGE }
