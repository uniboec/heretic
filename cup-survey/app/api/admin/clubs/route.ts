import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { listClubsAsAdmin } from '@/lib/registration/clubs'

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  try {
    const clubs = await listClubsAsAdmin(query)
    return NextResponse.json({ clubs })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}
