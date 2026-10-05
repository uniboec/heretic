import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { verifyAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const proofId = new URL(request.url).searchParams.get('proofId')

  const proof = proofId
    ? await prisma.paymentProof.findFirst({ where: { id: proofId, registrationId: id } })
    : await prisma.paymentProof.findFirst({
        where: { registrationId: id },
        orderBy: { uploadedAt: 'desc' },
      })
  if (!proof) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  try {
    const buffer = await readFile(proof.filePath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': proof.mimeType,
        'Content-Disposition': `inline; filename="proof-${proof.id}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 })
  }
}
