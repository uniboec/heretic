import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { AdminAthleteError, deleteAthleteAsAdmin, updateAthleteAsAdmin } from '@/lib/registration/service'
import { registrationImpactErrorResponse } from '@/lib/registration/registrationImpactErrors'
import { parseAthleteBody } from '@/lib/validation/registrationSchema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { athleteId } = await params
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
    await updateAthleteAsAdmin(athleteId, parsed.data, {
      impactToken: impactToken || undefined,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    if (error instanceof AdminAthleteError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    return apiErrorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { athleteId } = await params

  let impactToken: string | undefined
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && 'impactToken' in body) {
      const token = (body as { impactToken?: string }).impactToken
      impactToken = token || undefined
    }
  } catch {
    // DELETE without body is allowed for OPEN-only impact
  }

  try {
    await deleteAthleteAsAdmin(athleteId, { impactToken })
    return NextResponse.json({ success: true })
  } catch (error) {
    const impactResponse = registrationImpactErrorResponse(error)
    if (impactResponse) return impactResponse
    if (error instanceof AdminAthleteError) {
      if (error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      }
      if (error.code === 'LAST_ATHLETE') {
        return NextResponse.json({ error: 'LAST_ATHLETE' }, { status: 400 })
      }
    }
    return apiErrorResponse(error)
  }
}
