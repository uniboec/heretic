import { NextResponse } from 'next/server'
import { BRACKET_API_ERROR_LABELS } from '@/lib/brackets/labels'
import { bracketErrorResponse } from '@/lib/brackets/api'
import { TEAM_RANKING_DISCIPLINE_ALL, isValidTeamRankingDiscipline } from '@/lib/teamRankings/discipline'
import { getPublicTeamRankings } from '@/lib/teamRankings/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const discipline =
      new URL(request.url).searchParams.get('discipline') ?? TEAM_RANKING_DISCIPLINE_ALL

    if (!isValidTeamRankingDiscipline(discipline)) {
      return NextResponse.json({ error: 'INVALID_DISCIPLINE' }, { status: 400 })
    }

    const data = await getPublicTeamRankings(discipline)
    if (!data) {
      return NextResponse.json({ error: BRACKET_API_ERROR_LABELS.NOT_FOUND }, { status: 404 })
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return bracketErrorResponse(error)
  }
}
