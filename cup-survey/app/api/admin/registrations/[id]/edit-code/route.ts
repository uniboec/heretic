import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { prisma } from '@/lib/prisma'
import { hashEditCode } from '@/lib/registration/editAccess'
import { formatZodIssues } from '@/lib/validation/formatZodIssues'
import { adminSetEditCodeSchema } from '@/lib/validation/editCodeSchema'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = adminSetEditCodeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION', messages: formatZodIssues(parsed.error) },
        { status: 400 },
      )
    }

    const registration = await prisma.teamRegistration.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!registration) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    if (registration.status === 'CANCELLED') {
      return NextResponse.json({ error: 'CANCELLED' }, { status: 400 })
    }

    const editCodeHash = await hashEditCode(parsed.data.editCode)

    await prisma.teamRegistration.update({
      where: { id },
      data: { editCodeHash },
    })

    return NextResponse.json({ success: true, hasEditCode: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
