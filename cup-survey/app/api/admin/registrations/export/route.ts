import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { verifyAdminSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDisciplineLabel } from '@/lib/config/tournament'
import { getAgeDivisionLabel, getWeightCategoryLabel } from '@/lib/config/fseCategories'
import { getExperienceLevel, getExperienceLevelLabel } from '@/lib/config/experienceLevel'
import { getEntryPaymentStatusLabel, type EntryPaymentStatus } from '@/lib/registration/status'
import { ensureUnpaidPricesMatchCurrentStage } from '@/lib/registration/stagePricing'

export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureUnpaidPricesMatchCurrentStage()

  const format = new URL(request.url).searchParams.get('format') ?? 'csv'
  const registrations = await prisma.teamRegistration.findMany({
    include: { athletes: { include: { entries: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const rows: Record<string, string | number>[] = []
  for (const reg of registrations) {
    for (const athlete of reg.athletes) {
      for (const entry of athlete.entries) {
        rows.push({
          'Заявка №': reg.publicNumber,
          Фамилия: athlete.lastName,
          Имя: athlete.firstName,
          Отчество: athlete.middleName ?? '',
          'Дата рождения': athlete.birthDate.toISOString().slice(0, 10),
          Пол: athlete.gender,
          Клуб: reg.clubName,
          Город: reg.city,
          Телефон: reg.phone,
          'Эл. почта': reg.email ?? '',
          Дисциплина: getDisciplineLabel(entry.discipline),
          Группа: getExperienceLevelLabel(
            (entry.experienceLevel || getExperienceLevel(athlete.rank)) as 'novice' | 'experienced',
          ),
          'Возрастная категория': entry.ageDivisionId
            ? getAgeDivisionLabel(entry.ageDivisionId)
            : '',
          'Весовая категория': entry.weightCategoryId
            ? getWeightCategoryLabel(entry.weightCategoryId)
            : '',
          'Статус оплаты': getEntryPaymentStatusLabel(entry.paymentStatus as EntryPaymentStatus),
          'Статус заявки': reg.status,
          Сумма: entry.price,
        })
      }
    }
  }

  if (format === 'xlsx') {
    const sheet = XLSX.utils.json_to_sheet(rows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'registrations')
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="registrations.xlsx"',
      },
    })
  }

  const headers = Object.keys(rows[0] ?? { col: '' })
  const csv = [headers.join(';'), ...rows.map((row) => headers.map((h) => String(row[h] ?? '')).join(';'))].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="registrations.csv"',
    },
  })
}
