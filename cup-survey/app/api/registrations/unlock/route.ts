import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, isAllowedOrigin } from '@/lib/rateLimit'
import { parseRegistrationContact } from '@/lib/registration/contact'
import { assertEditAccess, findRegistrationByContactAndCode, grantDeviceAccess } from '@/lib/registration/editAccess'
import { formatZodIssues } from '@/lib/validation/formatZodIssues'
import { registrationUnlockSchema } from '@/lib/validation/registrationCreateSchema'

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = getClientIp(request)
  const rate = await checkRateLimit(`registration-unlock:ip:${ip}`)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = registrationUnlockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: formatZodIssues(parsed.error) }, { status: 400 })
  }

  const { contact, editCode, deviceToken } = parsed.data
  const parsedContact = parseRegistrationContact(contact)
  if (!parsedContact) {
    return NextResponse.json({ errors: ['Укажите корректный телефон или электронную почту'] }, { status: 400 })
  }

  const registration = await findRegistrationByContactAndCode({ ...parsedContact, editCode })
  if (!registration) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const allowed = await assertEditAccess(registration, { deviceToken, editCode })
  if (!allowed) {
    return NextResponse.json({ error: 'INVALID_CODE' }, { status: 403 })
  }

  await grantDeviceAccess(registration.id, deviceToken)

  return NextResponse.json({
    editToken: registration.editToken,
    publicNumber: registration.publicNumber,
  })
}
