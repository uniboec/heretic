import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { registrationApiErrorResponse } from '@/lib/registration/apiErrors'
import { AdminAthleteError, createAthleteAsAdmin } from '@/lib/registration/service'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { parseAthleteBody } from '@/lib/validation/registrationSchema'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parseAthleteBody(body)
  if (!parsed.data) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  const impactToken =
    body && typeof body === 'object' && 'impactToken' in body
      ? String((body as { impactToken?: string }).impactToken ?? '')
      : undefined

  try {
    const result = await createAthleteAsAdmin(id, parsed.data, {
      impactToken: impactToken || undefined,
    })
    return NextResponse.json({ success: true, athleteId: result.id })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    if (error instanceof AdminAthleteError) {
      if (error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      }
      if (error.code === 'REGISTRATION_CANCELLED') {
        return NextResponse.json(
          { errors: ['Нельзя добавить спортсмена в отменённую заявку.'] },
          { status: 400 },
        )
      }
    }
    return registrationApiErrorResponse(error)
  }
}
