#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import { getAgeOnEventDate } from '../lib/registration/categoryRules'
import { tournamentInfo } from '../lib/config/tournament'

const AGE_DIVISION_ID = 'm_youths_2'
const WEIGHT_CATEGORY_ID = 'm_youths_2_w_le_41'
const CATEGORY_KEYS = [
  `close_control:experienced:${AGE_DIVISION_ID}:${WEIGHT_CATEGORY_ID}`,
  `close_control:novice:${AGE_DIVISION_ID}:${WEIGHT_CATEGORY_ID}`,
  `tactic_control:experienced:${AGE_DIVISION_ID}:${WEIGHT_CATEGORY_ID}`,
  `tactic_control:novice:${AGE_DIVISION_ID}:${WEIGHT_CATEGORY_ID}`,
]

async function loadParticipants(categoryKey: string) {
  const gen = await requireWorkingGeneration(prisma)
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: gen.id, categoryKey },
    include: { participants: true, publicationState: true },
  })
  if (!draw) {
    const entries = await prisma.athleteEntry.findMany({
      where: {
        ageDivisionId: AGE_DIVISION_ID,
        weightCategoryId: WEIGHT_CATEGORY_ID,
        discipline: categoryKey.split(':')[0],
        experienceLevel: categoryKey.split(':')[1],
        athlete: { registration: { status: { not: 'CANCELLED' } } },
      },
      include: {
        athlete: {
          include: {
            registration: { select: { publicNumber: true, clubName: true } },
          },
        },
      },
    })
    return {
      categoryKey,
      categoryTitle: getCategoryTitleFromKey(categoryKey),
      inBracket: false,
      participantCount: 0,
      registrationCount: entries.length,
      registrations: entries.map((entry) => ({
        publicNumber: entry.athlete.registration.publicNumber,
        name: `${entry.athlete.lastName} ${entry.athlete.firstName}`,
        birthDate: entry.athlete.birthDate.toISOString().slice(0, 10),
        ageOnEventDate: getAgeOnEventDate(entry.athlete.birthDate, tournamentInfo.eventDate),
        paymentStatus: entry.paymentStatus,
        paymentStage: entry.paymentStage,
        clubName: entry.athlete.registration.clubName,
      })),
    }
  }

  const entryIds = draw.participants.map((p) => p.entryId)
  const entries = await prisma.athleteEntry.findMany({
    where: { id: { in: entryIds } },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true, clubName: true } },
        },
      },
    },
  })
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))

  const participants = draw.participants.map((p) => {
    const entry = entryById.get(p.entryId)
    if (!entry) {
      return {
        publicNumber: p.snapshotPublicNumber,
        name: p.snapshotDisplayName,
        birthDate: null,
        ageOnEventDate: null,
        paymentStatus: null,
        clubName: p.snapshotClubName,
      }
    }
    return {
      publicNumber: entry.athlete.registration.publicNumber,
      name: `${entry.athlete.lastName} ${entry.athlete.firstName}`,
      birthDate: entry.athlete.birthDate.toISOString().slice(0, 10),
      ageOnEventDate: getAgeOnEventDate(entry.athlete.birthDate, tournamentInfo.eventDate),
      paymentStatus: entry.paymentStatus,
      paymentStage: entry.paymentStage,
      clubName: entry.athlete.registration.clubName,
    }
  })

  return {
    categoryKey,
    categoryTitle: getCategoryTitleFromKey(categoryKey),
    inBracket: true,
    participantCount: draw.participants.length,
    registrationCount: participants.length,
    autoSystemId: draw.autoSystemId,
    visible: draw.publicationState?.visible ?? false,
    boutsReleased: draw.publicationState?.boutsReleased ?? false,
    participants,
  }
}

async function main() {
  const categories = []
  for (const categoryKey of CATEGORY_KEYS) {
    categories.push(await loadParticipants(categoryKey))
  }

  const withRegistrations = categories.filter((c) => c.registrationCount > 0)

  console.log(
    JSON.stringify(
      {
        ageDivisionId: AGE_DIVISION_ID,
        weightCategoryId: WEIGHT_CATEGORY_ID,
        weightLabel: 'до 41 кг',
        ageRange: '12–13 лет',
        eventDate: tournamentInfo.eventDate,
        categoriesWithAthletes: withRegistrations,
        allCheckedKeys: categories.map((c) => ({
          categoryKey: c.categoryKey,
          categoryTitle: c.categoryTitle,
          inBracket: c.inBracket,
          participantCount: c.participantCount,
          registrationCount: c.registrationCount,
        })),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
