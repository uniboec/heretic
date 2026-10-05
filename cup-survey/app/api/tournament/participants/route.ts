import { NextResponse } from 'next/server'
import { getAthleteAgeOnTournamentDate } from '@/lib/registration/categoryRules'
import { getPublicAthleteRows, getPublicParticipantStats } from '@/lib/registration/service'
import { buildPreliminaryCategories } from '@/lib/registration/categories'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const discipline = searchParams.get('discipline') ?? undefined
  const gender = searchParams.get('gender') ?? undefined
  const club = searchParams.get('club') ?? undefined
  const city = searchParams.get('city') ?? undefined
  const name = searchParams.get('name') ?? undefined
  const ageDivisionId = searchParams.get('ageDivisionId') ?? undefined
  const weightCategoryId = searchParams.get('weightCategoryId') ?? undefined
  const experienceLevel = searchParams.get('experienceLevel') ?? undefined
  const paymentStatus = searchParams.get('paymentStatus') ?? undefined
  const weightMin = searchParams.get('weightMin') ? Number(searchParams.get('weightMin')) : undefined
  const weightMax = searchParams.get('weightMax') ? Number(searchParams.get('weightMax')) : undefined
  const ageMin = searchParams.get('ageMin') ? Number(searchParams.get('ageMin')) : undefined
  const ageMax = searchParams.get('ageMax') ? Number(searchParams.get('ageMax')) : undefined

  const rows = await getPublicAthleteRows({
    discipline,
    gender,
    club,
    city,
    name,
    ageDivisionId,
    weightCategoryId,
    experienceLevel,
    paymentStatus,
    weightMin,
    weightMax,
    ageMin,
    ageMax,
  })
  const categories = buildPreliminaryCategories(rows)
  const stats = await getPublicParticipantStats()

  return NextResponse.json({
    stats,
    participants: rows.map((row) => ({
      fullName: row.fullName,
      clubName: row.clubName,
      city: row.city,
      gender: row.gender,
      weight: row.weight,
      disciplines: row.disciplines,
      entries: row.entries,
      paymentStatus: row.paymentStatus,
      status: row.status,
      hasWeighIn: row.hasWeighIn,
      ageYears: getAthleteAgeOnTournamentDate(row.birthDate) ?? 0,
    })),
    categories,
  })
}
