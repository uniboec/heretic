import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import {
  resetMatManualOrder,
  setBoutPinnedToEnd,
  setBoutsPinnedToEnd,
  updateMatManualOrder,
} from '@/lib/bouts/mutations'
import { moveBoutsToMatOnSchedule } from '@/lib/bouts/scheduleMoveBoutsToMat'
import {
  BoutPinPatchSchema,
  BoutsBulkMoveMatPatchSchema,
  BoutsBulkPinPatchSchema,
  MatManualOrderPatchSchema,
  MatManualOrderResetSchema,
} from '@/lib/bouts/schemas'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (body.action === 'reset_manual_order') {
      const parsed = MatManualOrderResetSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ errors: parsed.error.issues }, { status: 400 })
      }
      const result = await resetMatManualOrder(parsed.data)
      return NextResponse.json(result, { headers: NO_STORE_HEADERS })
    }

    if (body.action === 'pin') {
      const parsed = BoutPinPatchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ errors: parsed.error.issues }, { status: 400 })
      }
      const result = await setBoutPinnedToEnd(parsed.data)
      return NextResponse.json(result, { headers: NO_STORE_HEADERS })
    }

    if (body.action === 'pin_bulk') {
      const parsed = BoutsBulkPinPatchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ errors: parsed.error.issues }, { status: 400 })
      }
      const result = await setBoutsPinnedToEnd(parsed.data)
      return NextResponse.json(result, { headers: NO_STORE_HEADERS })
    }

    if (body.action === 'move_mat_bulk') {
      const parsed = BoutsBulkMoveMatPatchSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ errors: parsed.error.issues }, { status: 400 })
      }
      const result = await moveBoutsToMatOnSchedule(parsed.data)
      return NextResponse.json(result, { headers: NO_STORE_HEADERS })
    }

    const parsed = MatManualOrderPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.issues }, { status: 400 })
    }
    const result = await updateMatManualOrder(parsed.data)
    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
