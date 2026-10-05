import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { savePaymentProofFile } from '@/lib/registration/storage'
import {
  canSubmitPaymentForEntry,
  getCurrentPaymentStage,
  syncRegistrationTotals,
} from '@/lib/registration/entryPayment'
import type { EntryPaymentStatus } from '@/lib/registration/status'
import { notifyOrganizerPaymentProof } from '@/lib/notifications/organizer'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const registration = await prisma.teamRegistration.findUnique({ where: { id } })
  if (!registration) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  const form = await request.formData()
  const file = form.get('file')
  const entryIdsRaw = form.get('entryIds')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 })
  }

  let entryIds: string[] = []
  try {
    entryIds = JSON.parse(String(entryIdsRaw ?? '[]'))
  } catch {
    return NextResponse.json({ error: 'INVALID_ENTRY_IDS' }, { status: 400 })
  }

  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json({ error: 'ENTRY_IDS_REQUIRED' }, { status: 400 })
  }

  const stage = getCurrentPaymentStage()
  if (!stage) {
    return NextResponse.json({ error: 'REGISTRATION_CLOSED' }, { status: 403 })
  }

  const entries = await prisma.athleteEntry.findMany({
    where: {
      id: { in: entryIds },
      athlete: { registrationId: id },
    },
  })

  if (entries.length !== entryIds.length) {
    return NextResponse.json({ error: 'INVALID_ENTRIES' }, { status: 400 })
  }

  if (!entries.every((entry) => canSubmitPaymentForEntry(entry.paymentStatus as EntryPaymentStatus))) {
    return NextResponse.json({ error: 'INVALID_STATUS' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const amount = entries.reduce((sum, entry) => sum + entry.price, 0)

  try {
    const saved = await savePaymentProofFile(
      id,
      buffer,
      file.type || 'application/octet-stream',
      file.name,
    )

    const proofId = await prisma.$transaction(async (tx) => {
      const proof = await tx.paymentProof.create({
        data: {
          registrationId: id,
          filePath: saved.filePath,
          mimeType: file.type || 'application/octet-stream',
          fileSize: buffer.byteLength,
          amount,
          registrationStage: stage.stageId,
          status: 'pending',
        },
      })

      for (const entry of entries) {
        await tx.paymentProofEntry.deleteMany({ where: { entryId: entry.id } })

        await tx.athleteEntry.update({
          where: { id: entry.id },
          data: {
            paymentStage: stage.stageId,
            paymentStatus: 'PAYMENT_REVIEW',
          },
        })

        await tx.paymentProofEntry.create({
          data: {
            paymentProofId: proof.id,
            entryId: entry.id,
          },
        })
      }

      return proof.id
    })

    await syncRegistrationTotals(id)
    notifyOrganizerPaymentProof(id, proofId)
    return NextResponse.json({ success: true, amount, stage: stage.stageId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UPLOAD_FAILED'
    const code =
      error instanceof Error && 'code' in error
        ? String((error as NodeJS.ErrnoException).code)
        : ''
    if (message === 'INVALID_FILE_TYPE') {
      return NextResponse.json({ error: 'INVALID_FILE_TYPE' }, { status: 400 })
    }
    if (message === 'FILE_TOO_LARGE') {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 400 })
    }
    if (code === 'EACCES' || code === 'EPERM') {
      console.error('payment-proof upload permission error', error)
      return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
    }
    console.error('payment-proof upload failed', error)
    return NextResponse.json({ error: 'UPLOAD_FAILED' }, { status: 500 })
  }
}
