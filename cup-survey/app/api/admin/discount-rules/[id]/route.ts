import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import {
  CategoryDiscountRuleError,
  deleteCategoryDiscountRule,
  updateCategoryDiscountRule,
} from '@/lib/registration/categoryDiscounts'
import { formatZodIssues } from '@/lib/validation/formatZodIssues'
import { discountRuleUpdateBodySchema } from '@/lib/validation/discountRuleSchema'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const json = await request.json().catch(() => null)
  const parsed = discountRuleUpdateBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: formatZodIssues(parsed.error) },
      { status: 400 },
    )
  }

  try {
    const rule = await updateCategoryDiscountRule(id, parsed.data)
    return NextResponse.json({ rule })
  } catch (error) {
    if (error instanceof CategoryDiscountRuleError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.code }, { status })
    }
    console.error('PATCH /api/admin/discount-rules/[id] failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    await deleteCategoryDiscountRule(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof CategoryDiscountRuleError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: error.code }, { status: 404 })
    }
    console.error('DELETE /api/admin/discount-rules/[id] failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}
