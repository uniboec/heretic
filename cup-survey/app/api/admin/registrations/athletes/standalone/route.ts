import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { registrationApiErrorResponse } from '@/lib/registration/apiErrors'
import { createStandaloneAthleteAsAdmin } from '@/lib/registration/service'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { parseStandaloneAthleteBody } from '@/lib/validation/registrationSchema'

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseStandaloneAthleteBody(body)
  if (!parsed.data) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const impactToken =
    body && typeof body === 'object' && 'impactToken' in body
      ? String((body as { impactToken?: string }).impactToken ?? '')
      : undefined

  try {
    const result = await createStandaloneAthleteAsAdmin(parsed.data, {
      impactToken: impactToken || undefined,
    })
    return NextResponse.json({
      success: true,
      athleteId: result.athleteId,
      registrationId: result.registrationId,
      publicNumber: result.publicNumber,
    })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    return registrationApiErrorResponse(error)
  }
}
