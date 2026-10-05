import { NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/auth'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { TeamRankingSettingsPatchSchema } from '@/lib/teamRankings/schemas'
import {
  getTeamRankingSettings,
  toTeamRankingPointSettings,
  updateTeamRankingSettings,
} from '@/lib/teamRankings/settings'

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  const settings = await getTeamRankingSettings()
  return NextResponse.json({
    settings,
    pointSettings: toTeamRankingPointSettings(settings),
  })
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.Unauthorized }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = TeamRankingSettingsPatchSchema.parse(body)
    const settings = await updateTeamRankingSettings({
      firstPlacePoints: parsed.firstPlacePoints,
      secondPlacePoints: parsed.secondPlacePoints,
      thirdPlacePoints: parsed.thirdPlacePoints,
      soloParticipantPointsMode: parsed.soloParticipantPointsMode,
      soloParticipantFirstPlacePoints:
        parsed.soloParticipantPointsMode === 'CUSTOM'
          ? parsed.soloParticipantFirstPlacePoints ?? null
          : null,
    })

    return NextResponse.json({
      settings,
      pointSettings: toTeamRankingPointSettings(settings),
    })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
