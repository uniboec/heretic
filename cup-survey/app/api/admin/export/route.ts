import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { verifyAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getPrimaryBeltLabel,
  getPrimaryCupLabel,
  getPrimaryMedalLabel,
  getPrimaryPackageId,
  getPrimaryPackageLabel,
  getPrimaryVenueLabel,
  getResponseEntryFee,
} from '@/lib/surveyResponse'

function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      const s = v == null ? '' : String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    .join(',')
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'csv'
  const responses = await prisma.surveyResponse.findMany({ orderBy: { createdAt: 'desc' } })

  const headers = [
    'id',
    'submissionId',
    'createdAt',
    'representativeName',
    'roles',
    'rolesOther',
    'organizationName',
    'city',
    'phone',
    'athletesCount',
    'disciplines',
    'acceptableVenues',
    'preferredVenue',
    'primaryVenueLabel',
    'dayFormatPreference',
    'acceptableMedals',
    'preferredMedal',
    'primaryMedalLabel',
    'acceptableBelts',
    'preferredBelt',
    'primaryBeltLabel',
    'acceptableCups',
    'preferredCup',
    'primaryCupLabel',
    'acceptablePrizeCompositions',
    'acceptableAwardPackages',
    'primaryAwardPackageId',
    'primaryAwardPackageLabel',
    'calculatedEntryFee',
    'priorities',
    'prioritiesOther',
    'comment',
  ]

  const rows = responses.map((response) => [
    response.id,
    response.submissionId,
    response.createdAt.toISOString(),
    response.representativeName,
    response.roles.join(';'),
    response.rolesOther,
    response.organizationName,
    response.city,
    response.phone,
    response.athletesCount,
    response.disciplines.join(';'),
    response.acceptableVenues.join(';'),
    response.preferredVenue,
    getPrimaryVenueLabel(response),
    response.dayFormatPreference,
    response.acceptableMedals.join(';'),
    response.preferredMedal,
    getPrimaryMedalLabel(response),
    response.acceptableBelts.join(';'),
    response.preferredBelt,
    getPrimaryBeltLabel(response),
    response.acceptableCups.join(';'),
    response.preferredCup,
    getPrimaryCupLabel(response),
    response.acceptablePrizeCompositions.join(';'),
    response.acceptableAwardPackages.join(';'),
    getPrimaryPackageId(response),
    getPrimaryPackageLabel(response),
    getResponseEntryFee(response),
    response.priorities.join(';'),
    response.prioritiesOther,
    response.comment,
  ])

  if (format === 'xlsx') {
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Responses')
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cup26-survey.xlsx"',
      },
    })
  }

  const csv = [toCsvRow(headers), ...rows.map((row) => toCsvRow(row))].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="cup26-survey.csv"',
    },
  })
}
