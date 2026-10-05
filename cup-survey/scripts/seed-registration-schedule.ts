import { PrismaClient } from '@prisma/client'
import { TOURNAMENT_TIMEZONE } from '../lib/config/tournament'
import { invalidateRegistrationScheduleCache } from '../lib/registration/schedule'

const prisma = new PrismaClient()

function yekaterinburgParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return { year: get('year'), month: get('month'), day: get('day') }
}

function tournamentIso(year: number, month: number, day: number, hour: number, minute: number, second = 0) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+05:00`,
  ).toISOString()
}

function addDays(year: number, month: number, day: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1, day + delta, 12, 0, 0))
  return yekaterinburgParts(date)
}

function buildLocalTestSchedule() {
  const today = yekaterinburgParts(new Date())
  const yesterday = addDays(today.year, today.month, today.day, -1)
  const regularEnd = addDays(today.year, today.month, today.day, 3)
  const lateStart = addDays(today.year, today.month, today.day, 4)
  const lateEnd = addDays(today.year, today.month, today.day, 7)

  return {
    registrationClosesAt: tournamentIso(lateEnd.year, lateEnd.month, lateEnd.day, 17, 0, 0),
    stages: [
      {
        id: 'early',
        label: 'Ранняя регистрация',
        bannerTitle: 'Ранняя регистрация',
        pricePerDiscipline: 1500,
        startsAt: null,
        endsAt: tournamentIso(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59),
        sortOrder: 0,
      },
      {
        id: 'regular',
        label: 'Основная регистрация',
        bannerTitle: 'Основная регистрация',
        pricePerDiscipline: 1800,
        startsAt: tournamentIso(today.year, today.month, today.day, 0, 0, 0),
        endsAt: tournamentIso(regularEnd.year, regularEnd.month, regularEnd.day, 23, 59, 59),
        sortOrder: 1,
      },
      {
        id: 'late',
        label: 'Поздняя регистрация',
        bannerTitle: 'Поздняя регистрация',
        pricePerDiscipline: 2000,
        startsAt: tournamentIso(lateStart.year, lateStart.month, lateStart.day, 0, 0, 0),
        endsAt: tournamentIso(lateEnd.year, lateEnd.month, lateEnd.day, 17, 0, 0),
        sortOrder: 2,
      },
    ],
  }
}

async function main() {
  const schedule = buildLocalTestSchedule()

  await prisma.$transaction(async (tx) => {
    for (const stage of schedule.stages) {
      await tx.registrationStage.upsert({
        where: { id: stage.id },
        create: {
          id: stage.id,
          label: stage.label,
          bannerTitle: stage.bannerTitle,
          pricePerDiscipline: stage.pricePerDiscipline,
          startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
          endsAt: new Date(stage.endsAt),
          sortOrder: stage.sortOrder,
        },
        update: {
          label: stage.label,
          bannerTitle: stage.bannerTitle,
          pricePerDiscipline: stage.pricePerDiscipline,
          startsAt: stage.startsAt ? new Date(stage.startsAt) : null,
          endsAt: new Date(stage.endsAt),
          sortOrder: stage.sortOrder,
        },
      })
    }

    await tx.registrationScheduleSetting.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        registrationClosesAt: new Date(schedule.registrationClosesAt),
      },
      update: {
        registrationClosesAt: new Date(schedule.registrationClosesAt),
      },
    })
  })

  invalidateRegistrationScheduleCache()

  console.log('Registration schedule seeded for local testing:')
  for (const stage of schedule.stages) {
    console.log(
      `- ${stage.label} (${stage.id}): ${stage.pricePerDiscipline} ₽, ends ${stage.endsAt}`,
    )
  }
  console.log(`Registration closes at: ${schedule.registrationClosesAt}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
