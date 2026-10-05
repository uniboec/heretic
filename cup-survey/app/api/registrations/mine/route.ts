import { NextResponse } from 'next/server'
import { getDeviceTokenFromRequest, listRegistrationsForDevice } from '@/lib/registration/editAccess'
import { getPublicStatusLabel } from '@/lib/registration/status'
import type { RegistrationStatus } from '@/lib/registration/status'

export async function GET(request: Request) {
  const deviceToken = getDeviceTokenFromRequest(request)
  if (!deviceToken) {
    return NextResponse.json({ error: 'DEVICE_REQUIRED' }, { status: 400 })
  }

  const registrations = await listRegistrationsForDevice(deviceToken)

  return NextResponse.json({
    registrations: registrations.map((reg: (typeof registrations)[number]) => ({
      ...reg,
      statusLabel: getPublicStatusLabel(reg.status as RegistrationStatus, {
        hasPaidEntries: reg.hasPaidEntries,
        hasUnpaidEntries: reg.hasUnpaidEntries,
        hasReviewEntries: reg.hasReviewEntries,
      }),
    })),
  })
}
