#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'

const KEYS = [
  'tactic_control:experienced:m_boys_3:m_boys_3_w_le_32',
  'close_control:experienced:m_boys_3:m_boys_3_w_le_32',
]
const ENTRY_IDS = [] as string[]

async function main() {
  const athlete = await prisma.athlete.findFirst({
    where: {
      lastName: { equals: 'Очур-Оол', mode: 'insensitive' },
      firstName: { equals: 'Марк', mode: 'insensitive' },
    },
    include: { entries: true },
  })
  if (!athlete) throw new Error('athlete not found')

  const gen = await requireWorkingGeneration(prisma)

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: gen.id, categoryKey: { in: KEYS } },
    include: {
      participants: true,
      publicationState: true,
    },
  })

  console.log(
    JSON.stringify(
      {
        athleteId: athlete.id,
        entryIds: athlete.entries.map((e) => ({
          id: e.id,
          discipline: e.discipline,
          paymentStatus: e.paymentStatus,
        })),
        generationId: gen.id,
        draws: draws.map((draw) => ({
          id: draw.id,
          categoryKey: draw.categoryKey,
          autoSystemId: draw.autoSystemId,
          participantCount: draw.participants.length,
          participants: draw.participants.map((p) => ({
            entryId: p.entryId,
            seedPosition: p.seedPosition,
            snapshotDisplayName: p.snapshotDisplayName,
          })),
          visible: draw.publicationState?.visible ?? false,
          boutsReleased: draw.publicationState?.boutsReleased ?? false,
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
  .finally(async () => {
    await prisma.$disconnect()
  })
