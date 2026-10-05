import { NextResponse } from 'next/server'
import { isAllowedOrigin, checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { parseRegistrationCreateBody } from '@/lib/validation/registrationCreateSchema'
import { registrationApiErrorResponse } from '@/lib/registration/apiErrors'
import { getRegistrationPublicErrorMessage } from '@/lib/registration/publicErrorMessages'
import { notifyOrganizerNewRegistration } from '@/lib/notifications/organizer'
import { createTeamRegistration } from '@/lib/registration/service'

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { errors: [getRegistrationPublicErrorMessage('Forbidden')] },
      { status: 403 },
    )
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit(`registration:ip:${ip}`)
  if (!rate.allowed) {
    return NextResponse.json(
      { errors: [getRegistrationPublicErrorMessage('Too many requests')] },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { errors: [getRegistrationPublicErrorMessage('Invalid JSON')] },
      { status: 400 },
    )
  }

  const parsed = parseRegistrationCreateBody(body)
  if (!parsed.data) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  try {
    const created = await createTeamRegistration(parsed.data, request.headers.get('user-agent') ?? undefined)
    notifyOrganizerNewRegistration(created.id)
    return NextResponse.json({ success: true, ...created }, { status: 201 })
  } catch (error) {
    return registrationApiErrorResponse(error)
  }
}
