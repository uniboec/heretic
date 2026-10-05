import { NextResponse } from 'next/server'
import { parseRegistrationBody } from '@/lib/validation/registrationSchema'
import {
  getRegistrationByToken,
  updateTeamRegistration,
  RegistrationClosedError,
  RegistrationEditError,
} from '@/lib/registration/service'
import { getRegistrationPublicErrorMessage } from '@/lib/registration/publicErrorMessages'
import { getPaymentDetails, formatPaymentPurpose } from '@/lib/registration/payment'
import { getPublicStatusLabel } from '@/lib/registration/status'
import type { RegistrationStatus } from '@/lib/registration/status'
import {
  assertEditAccess,
  getDeviceTokenFromRequest,
} from '@/lib/registration/editAccess'
import { serializeAthleteEntries } from '@/lib/registration/entrySerialization'
import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'

async function authorize(
  registration: { id: string; editCodeHash: string | null; publicNumber: number },
  request: Request,
  editCode?: string | null,
) {
  const deviceToken = getDeviceTokenFromRequest(request)
  const allowed = await assertEditAccess(registration, { deviceToken, editCode })
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'EDIT_AUTH_REQUIRED',
        publicNumber: registration.publicNumber,
        needsEditCode: Boolean(registration.editCodeHash),
      },
      { status: 403 },
    )
  }
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  await ensureUnpaidPricesMatchCurrentStage()
  const registration = await getRegistrationByToken(token)
  if (!registration) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const authError = await authorize(
    {
      id: registration.id,
      editCodeHash: registration.editCodeHash,
      publicNumber: registration.publicNumber,
    },
    request,
  )
  if (authError) return authError

  const payment = getPaymentDetails()

  return NextResponse.json({
    id: registration.id,
    publicNumber: registration.publicNumber,
    editToken: registration.editToken,
    status: registration.status,
    statusLabel: getPublicStatusLabel(registration.status as RegistrationStatus),
    totalAmount: registration.totalAmount,
    pricePerDiscipline: registration.pricePerDiscipline,
    registrationStage: registration.registrationStage,
    clubId: registration.clubId,
    clubName: registration.clubName,
    city: registration.city,
    phone: registration.phone,
    email: registration.email ?? '',
    athletes: registration.athletes.map((a) => ({
      athleteId: a.id,
      lastName: a.lastName,
      firstName: a.firstName,
      middleName: a.middleName,
      fullName: formatAthleteFullName({
        lastName: a.lastName,
        firstName: a.firstName,
        middleName: a.middleName,
      }),
      birthDate: a.birthDate.toISOString().slice(0, 10),
      gender: a.gender,
      rank: a.rank,
      disciplineEntries: serializeAthleteEntries(a.entries, a.rank, { publicView: true }).map((entry) => ({
        entryId: entry.id,
        discipline: entry.discipline,
        ageDivisionId: entry.ageDivisionId ?? '',
        weightCategoryId: entry.weightCategoryId ?? '',
        experienceLevel: entry.experienceLevel,
        paymentStatus: entry.paymentStatus,
        paymentStatusLabel: entry.paymentStatusLabel,
        price: entry.price,
      })),
      amount: a.entries.reduce((sum, e) => sum + e.price, 0),
    })),
    payment: {
      ...payment,
      purpose: formatPaymentPurpose(payment.purposeTemplate, registration.publicNumber, registration.clubName),
    },
    hasPaymentProof: registration.paymentProofs.length > 0,
    latestProofStatus: registration.paymentProofs[0]?.status ?? null,
    adminComment: registration.paymentProofs[0]?.adminComment ?? registration.adminComment,
    hasEditCode: Boolean(registration.editCodeHash),
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const registration = await getRegistrationByToken(token)
  if (!registration) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const editCode =
    body && typeof body === 'object' && 'editCode' in body && typeof body.editCode === 'string'
      ? body.editCode
      : null

  const authError = await authorize(
    {
      id: registration.id,
      editCodeHash: registration.editCodeHash,
      publicNumber: registration.publicNumber,
    },
    request,
    editCode,
  )
  if (authError) return authError

  const parsed = parseRegistrationBody(body)
  if (!parsed.data) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  try {
    const updated = await updateTeamRegistration(token, parsed.data)
    return NextResponse.json({ success: true, ...updated })
  } catch (error) {
    if (error instanceof RegistrationEditError) {
      return NextResponse.json({ errors: error.messages }, { status: 400 })
    }
    if (error instanceof RegistrationClosedError) {
      return NextResponse.json(
        { errors: [getRegistrationPublicErrorMessage('REGISTRATION_CLOSED')] },
        { status: 403 },
      )
    }
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { errors: [getRegistrationPublicErrorMessage('NOT_FOUND')] },
        { status: 404 },
      )
    }
    throw error
  }
}
