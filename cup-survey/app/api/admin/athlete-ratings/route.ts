import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import {
  AthleteRatingSettingsPatchSchema,
  AthleteRatingViewSchema,
} from '@/lib/athleteRatings/schemas'
import { getAdminAthleteRatings } from '@/lib/athleteRatings/service'
import {
  getAthleteRatingSettings,
  updateAthleteRatingSettings,
} from '@/lib/athleteRatings/settings'
import { validateAthleteRatingSettingsInput } from '@/lib/athleteRatings/settingsValidation'

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const viewParam = searchParams.get('view') ?? 'overall'
  const parsedView = AthleteRatingViewSchema.safeParse(viewParam)
  if (!parsedView.success) {
    return NextResponse.json({ error: 'Invalid view' }, { status: 400 })
  }

  const result = await getAdminAthleteRatings(parsedView.data)
  return NextResponse.json(result)
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = AthleteRatingSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.issues.map((issue) => ({ message: issue.message })) },
        { status: 400 },
      )
    }

    const validationErrors = validateAthleteRatingSettingsInput(parsed.data)
    if (validationErrors.length > 0) {
      return NextResponse.json({ errors: validationErrors }, { status: 400 })
    }

    const settings = await updateAthleteRatingSettings(parsed.data)

    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get('view') ?? 'overall'
    const parsedView = AthleteRatingViewSchema.safeParse(viewParam)
    const view = parsedView.success ? parsedView.data : 'overall'
    const ranking = await getAdminAthleteRatings(view)

    return NextResponse.json({
      settings,
      view: ranking.view,
      rows: ranking.rows,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
