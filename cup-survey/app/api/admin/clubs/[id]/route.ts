import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { AdminClubError, updateClubAsAdmin } from '@/lib/registration/clubs'
import { parseClubUpdateBody } from '@/lib/validation/clubSchema'

export async function PATCH(
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

  const parsed = parseClubUpdateBody(body)
  if (!parsed.data) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 })
  }

  try {
    const club = await updateClubAsAdmin(id, parsed.data)
    return NextResponse.json({ success: true, club })
  } catch (error) {
    if (error instanceof AdminClubError) {
      if (error.code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      }
      if (error.code === 'DUPLICATE') {
        return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
      }
      if (error.code === 'INVALID') {
        return NextResponse.json({ error: 'INVALID' }, { status: 400 })
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}
