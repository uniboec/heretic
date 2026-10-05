#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { getRegistrationCategoryKey, getRegistrationCategoryIdentity, getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const athlete = await prisma.athlete.findFirst({
    where: {
      lastName: { equals: 'Очур-Оол', mode: 'insensitive' },
      firstName: { equals: 'Марк', mode: 'insensitive' },
      registration: { status: { not: 'CANCELLED' } },
    },
    include: {
      entries: true,
      registration: { select: { publicNumber: true, status: true, totalAmount: true } },
    },
  })

  if (!athlete) {
    console.log(JSON.stringify({ found: false }, null, 2))
    return
  }

  const gen = await requireWorkingGeneration(prisma)
  const brackets = []
  for (const entry of athlete.entries) {
    const categoryKey = getRegistrationCategoryKey(getRegistrationCategoryIdentity(entry, athlete)!)
    const participant = await prisma.bracketDrawParticipant.findFirst({
      where: { entryId: entry.id, draw: { generationId: gen.id, categoryKey } },
      include: { draw: { include: { participants: true, publicationState: true } } },
    })
    brackets.push({
      discipline: entry.discipline,
      categoryKey,
      categoryTitle: getCategoryTitleFromKey(categoryKey),
      paymentStatus: entry.paymentStatus,
      paymentStage: entry.paymentStage,
      price: entry.price,
      inBracket: Boolean(participant),
      participantCount: participant?.draw.participants.length ?? 0,
      visible: participant?.draw.publicationState?.visible ?? false,
    })
  }

  console.log(
    JSON.stringify(
      {
        found: true,
        athleteId: athlete.id,
        publicNumber: athlete.registration.publicNumber,
        registrationStatus: athlete.registration.status,
        totalAmount: athlete.registration.totalAmount,
        brackets,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
