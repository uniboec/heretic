import { createHash } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '../prisma'
import { normalizeEmail } from '../email'
import { normalizePhoneToE164 } from '../phone'

export const REGISTRATION_DEVICE_HEADER = 'x-registration-device'

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashEditCode(code: string): Promise<string> {
  return bcrypt.hash(code.trim(), 12)
}

export async function verifyEditCode(code: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false
  return bcrypt.compare(code.trim(), hash)
}

export function getDeviceTokenFromRequest(request: Request): string | null {
  const token = request.headers.get(REGISTRATION_DEVICE_HEADER)?.trim()
  return token || null
}

export async function grantDeviceAccess(registrationId: string, deviceToken: string): Promise<void> {
  const deviceTokenHash = hashDeviceToken(deviceToken)
  await prisma.registrationDeviceAccess.upsert({
    where: {
      registrationId_deviceTokenHash: { registrationId, deviceTokenHash },
    },
    create: { registrationId, deviceTokenHash },
    update: { lastUsedAt: new Date() },
  })
}

export async function hasDeviceAccess(registrationId: string, deviceToken: string): Promise<boolean> {
  const row = await prisma.registrationDeviceAccess.findUnique({
    where: {
      registrationId_deviceTokenHash: {
        registrationId,
        deviceTokenHash: hashDeviceToken(deviceToken),
      },
    },
  })
  return Boolean(row)
}

export async function assertEditAccess(
  registration: { id: string; editCodeHash: string | null },
  options: { deviceToken?: string | null; editCode?: string | null },
): Promise<boolean> {
  if (!registration.editCodeHash) return true

  if (options.deviceToken && (await hasDeviceAccess(registration.id, options.deviceToken))) {
    await grantDeviceAccess(registration.id, options.deviceToken)
    return true
  }

  if (options.editCode && (await verifyEditCode(options.editCode, registration.editCodeHash))) {
    if (options.deviceToken) {
      await grantDeviceAccess(registration.id, options.deviceToken)
    }
    return true
  }

  return false
}

export async function findRegistrationByEntryId(entryId: string): Promise<{
  id: string
  editToken: string
  publicNumber: number
  editCodeHash: string | null
  status: string
} | null> {
  const entry = await prisma.athleteEntry.findUnique({
    where: { id: entryId },
    select: {
      athlete: {
        select: {
          registration: {
            select: {
              id: true,
              editToken: true,
              publicNumber: true,
              editCodeHash: true,
              status: true,
              consentPublication: true,
            },
          },
        },
      },
    },
  })

  const registration = entry?.athlete.registration
  if (!registration || registration.status === 'CANCELLED' || !registration.consentPublication) {
    return null
  }

  return registration
}

export async function findRegistrationByContactAndCode(input: {
  phone?: string
  email?: string
  editCode: string
}): Promise<{ id: string; editToken: string; publicNumber: number; editCodeHash: string | null } | null> {
  const phone = input.phone ? normalizePhoneToE164(input.phone) : null
  const email = input.email ? normalizeEmail(input.email) : null
  if (!phone && !email) return null

  const candidates = await prisma.teamRegistration.findMany({
    where: {
      status: { not: 'CANCELLED' },
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: {
      id: true,
      editToken: true,
      publicNumber: true,
      editCodeHash: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const matches = []
  for (const registration of candidates) {
    if (await verifyEditCode(input.editCode, registration.editCodeHash)) {
      matches.push(registration)
    }
  }

  return matches[0] ?? null
}

export async function listRegistrationsForDevice(deviceToken: string) {
  const deviceTokenHash = hashDeviceToken(deviceToken)
  const rows = await prisma.registrationDeviceAccess.findMany({
    where: { deviceTokenHash },
    include: {
      registration: {
        include: {
          athletes: { include: { entries: true } },
        },
      },
    },
    orderBy: { lastUsedAt: 'desc' },
  })

  type AccessRow = (typeof rows)[number]

  return rows
    .filter((row: AccessRow) => row.registration.status !== 'CANCELLED')
    .map((row: AccessRow) => {
      const entries = row.registration.athletes.flatMap((athlete) => athlete.entries)
      const unpaidAmount = entries
        .filter((entry) => entry.paymentStatus === 'UNPAID')
        .reduce((sum, entry) => sum + entry.price, 0)

      return {
        id: row.registration.id,
        publicNumber: row.registration.publicNumber,
        editToken: row.registration.editToken,
        clubName: row.registration.clubName,
        city: row.registration.city,
        status: row.registration.status,
        totalAmount: row.registration.totalAmount,
        unpaidAmount,
        hasPaidEntries: entries.some((entry) => entry.paymentStatus === 'PAID'),
        hasUnpaidEntries: entries.some((entry) => entry.paymentStatus === 'UNPAID'),
        hasReviewEntries: entries.some((entry) => entry.paymentStatus === 'PAYMENT_REVIEW'),
        athletesCount: row.registration.athletes.length,
        updatedAt: row.registration.updatedAt.toISOString(),
      }
    })
}
