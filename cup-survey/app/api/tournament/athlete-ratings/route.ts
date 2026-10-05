import { NextResponse } from 'next/server'
import { AthleteRatingViewSchema } from '@/lib/athleteRatings/schemas'
import { getPublicAthleteRatings } from '@/lib/athleteRatings/service'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const disciplineParam = searchParams.get('discipline') ?? 'overall'
  const parsed = AthleteRatingViewSchema.safeParse(disciplineParam)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid discipline' }, { status: 400 })
  }

  const result = await getPublicAthleteRatings(parsed.data)
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(result)
}
