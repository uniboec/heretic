import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import {
  CategoryDiscountRuleError,
  createCategoryDiscountRule,
  listCategoryDiscountRulesAdmin,
} from '@/lib/registration/categoryDiscounts'
import { formatZodIssues } from '@/lib/validation/formatZodIssues'
import { discountRuleBodySchema } from '@/lib/validation/discountRuleSchema'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rules = await listCategoryDiscountRulesAdmin()
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('GET /api/admin/discount-rules failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}

export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const json = await request.json().catch(() => null)
  const parsed = discountRuleBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { errors: formatZodIssues(parsed.error) },
      { status: 400 },
    )
  }

  try {
    const rule = await createCategoryDiscountRule(parsed.data)
    return NextResponse.json({ rule })
  } catch (error) {
    if (error instanceof CategoryDiscountRuleError) {
      return NextResponse.json({ error: error.code }, { status: 400 })
    }
    console.error('POST /api/admin/discount-rules failed', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2022' || error.code === 'P2021')
    ) {
      return NextResponse.json({ error: 'DB_MIGRATION_REQUIRED' }, { status: 500 })
    }
    return apiErrorResponse(error)
  }
}
