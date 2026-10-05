import { NextResponse } from 'next/server'
import { loadRegistrationSchedule } from '@/lib/registration/schedule'
import { getRegistrationById } from '@/lib/registration/service'
import { getPaymentDetails, formatPaymentPurpose } from '@/lib/registration/payment'
import { getClubDiscountPercent } from '@/lib/registration/pricing'
import {
  ensureUnpaidPricesMatchCurrentStage,
  getEffectiveBasePriceForUnpaidEntries,
} from '@/lib/registration/stagePricing'
import { getPublicStatusLabel } from '@/lib/registration/status'
import type { RegistrationStatus } from '@/lib/registration/status'
import { serializeAthleteEntries } from '@/lib/registration/entrySerialization'
import { formatAthleteFullName } from '@/lib/registration/athleteName'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await loadRegistrationSchedule()
  await ensureUnpaidPricesMatchCurrentStage()
  const registration = await getRegistrationById(id)
  if (!registration) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const payment = getPaymentDetails()
  const athletes = registration.athletes.map((a) => {
    const entries = serializeAthleteEntries(a.entries, a.rank, { publicView: true })
    const unpaidEntryIds = entries.filter((e) => e.paymentStatus === 'UNPAID').map((e) => e.id)
    return {
      id: a.id,
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
      entries,
      amount: entries.reduce((sum, e) => sum + e.price, 0),
      unpaidEntryIds,
    }
  })

  const allEntries = athletes.flatMap((a) => a.entries)
  const unpaidAmount = allEntries
    .filter((e) => e.paymentStatus === 'UNPAID')
    .reduce((sum, e) => sum + e.price, 0)
  const basePricePerDiscipline = getEffectiveBasePriceForUnpaidEntries(registration.registrationStage)
  const clubDiscountPercent = getClubDiscountPercent(
    basePricePerDiscipline,
    registration.pricePerDiscipline,
  )

  return NextResponse.json({
    id: registration.id,
    publicNumber: registration.publicNumber,
    status: registration.status,
    statusLabel: getPublicStatusLabel(registration.status as RegistrationStatus, {
      hasPaidEntries: allEntries.some((entry) => entry.paymentStatus === 'PAID'),
      hasUnpaidEntries: allEntries.some((entry) => entry.paymentStatus === 'UNPAID'),
      hasReviewEntries: allEntries.some((entry) => entry.paymentStatus === 'PAYMENT_REVIEW'),
    }),
    totalAmount: registration.totalAmount,
    unpaidAmount,
    pricePerDiscipline: registration.pricePerDiscipline,
    basePricePerDiscipline,
    clubDiscountPercent,
    registrationStage: registration.registrationStage,
    clubName: registration.clubName,
    city: registration.city,
    phone: registration.phone,
    athletes,
    payment: {
      ...payment,
      purpose: formatPaymentPurpose(payment.purposeTemplate, registration.publicNumber, registration.clubName),
    },
    hasPaymentProof: registration.paymentProofs.length > 0,
    latestProofStatus: registration.paymentProofs[0]?.status ?? null,
    adminComment: registration.paymentProofs[0]?.adminComment ?? registration.adminComment,
  })
}
