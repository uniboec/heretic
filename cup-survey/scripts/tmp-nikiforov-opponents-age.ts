#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getAgeOnEventDate } from '../lib/registration/categoryRules'
import { tournamentInfo } from '../lib/config/tournament'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const NIKIFOROV_ID = 'fc74d575-12f5-4865-8c89-7629c4b26945'
const CATEGORY_KEY = 'close_control:experienced:m_youths_1:m_youths_1_w_le_41'

async function main() {
  const gen = await requireWorkingGeneration(prisma)
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: gen.id, categoryKey: CATEGORY_KEY },
    include: { participants: true },
  })

  if (!draw) {
    console.log(JSON.stringify({ error: 'category_not_found', categoryKey: CATEGORY_KEY }, null, 2))
    return
  }

  const entryIds = draw.participants.map((p) => p.entryId)
  const entries = await prisma.athleteEntry.findMany({
    where: { id: { in: entryIds } },
    include: {
      athlete: {
        include: {
          registration: { select: { publicNumber: true, clubName: true, city: true } },
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
        name: p.snapshotDisplayName ?? 'unknown',
        birthDate: null,
        ageOnEventDate: null,
        isNikiforov: false,
        clubName: p.snapshotClubName,
        city: p.snapshotCity,
      }
    }
    const athlete = entry.athlete
    const birthDate = athlete.birthDate.toISOString().slice(0, 10)
    const age = getAgeOnEventDate(birthDate, tournamentInfo.eventDate)
    return {
      publicNumber: athlete.registration.publicNumber,
      name: `${athlete.lastName} ${athlete.firstName}${athlete.middleName ? ` ${athlete.middleName}` : ''}`,
      birthDate,
      ageOnEventDate: age,
      isNikiforov: athlete.id === NIKIFOROV_ID,
      clubName: athlete.registration.clubName,
      city: athlete.registration.city,
    }
  })

  const nikiforov = participants.find((p) => p.isNikiforov)
  const opponents = participants.filter((p) => !p.isNikiforov)

  console.log(
    JSON.stringify(
      {
        categoryKey: CATEGORY_KEY,
        categoryTitle: getCategoryTitleFromKey(CATEGORY_KEY),
        eventDate: tournamentInfo.eventDate,
        participantCount: participants.length,
        nikiforov,
        opponents,
        opponentAges: opponents.map((o) => o.ageOnEventDate),
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
