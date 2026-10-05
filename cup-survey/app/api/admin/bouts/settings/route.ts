import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { getNormalizedBoutsPageSettings } from '@/lib/bouts/service'
import { updateBoutsPageSettings } from '@/lib/bouts/mutations'
import { AdminBoutsSettingsPatchSchema } from '@/lib/bouts/schemas'
import { NO_STORE_HEADERS } from '@/lib/bouts/routeSegmentConfig'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const settings = await getNormalizedBoutsPageSettings()
    return NextResponse.json(
      {
        settings: {
          publicEnabled: settings.publicEnabled,
          matCount: settings.matCount,
          matsEnabled: settings.matsEnabled,
          scheduleVersion: settings.scheduleVersion,
          autoMatAssignMode: settings.autoMatAssignMode,
          autoMatByCategoryEnabled: settings.autoMatByCategoryEnabled,
          boutsStartTime: settings.boutsStartTime,
          matStartTimeOverrides: settings.matStartTimeOverrides,
          boutBreakMinutes: settings.boutBreakMinutes,
          ageDivisionDurationOverrides: settings.ageDivisionDurationOverrides,
          pinAllFinalsToEnd: settings.pinAllFinalsToEnd,
          athleteParticipationSpacing: settings.athleteParticipationSpacing,
          scheduleLegacyGap: settings.scheduleLegacyGap,
          eventFinalized: settings.eventFinalized,
        },
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (error) {
    return bracketErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = AdminBoutsSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }
    const result = await updateBoutsPageSettings(parsed.data)
    return NextResponse.json(result, { headers: NO_STORE_HEADERS })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
