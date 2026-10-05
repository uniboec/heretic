import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, isAllowedOrigin } from '@/lib/rateLimit'
import { getRegistrationByToken } from '@/lib/registration/service'
import { assertEditAccess, grantDeviceAccess } from '@/lib/registration/editAccess'
import { formatZodIssues } from '@/lib/validation/formatZodIssues'
import { registrationEditAuthSchema } from '@/lib/validation/registrationCreateSchema'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit(`registration-unlock:ip:${ip}`)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { token } = await params
  const registration = await getRegistrationByToken(token)
  if (!registration || registration.status === 'CANCELLED') {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = registrationEditAuthSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: formatZodIssues(parsed.error) }, { status: 400 })
  }

  const allowed = await assertEditAccess(registration, parsed.data)
  if (!allowed) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 403 })
  }

  await grantDeviceAccess(registration.id, parsed.data.deviceToken)

  return NextResponse.json({ success: true, publicNumber: registration.publicNumber })
}
