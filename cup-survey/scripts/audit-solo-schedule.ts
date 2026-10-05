import { prisma } from '../lib/prisma'
import { categoryEligibleForAwardsSchedule } from '../lib/brackets/core/categoryRequiresBouts'

async function main() {
  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen) {
    console.log('no live generation')
    return
  }

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: gen.id, status: 'ACTIVE' },
    include: {
      participants: true,
      publicationState: true,
    },
    orderBy: { categoryKey: 'asc' },
  })

  const solo = draws.filter((draw) =>
    categoryEligibleForAwardsSchedule({
      status: draw.status,
      autoSystemId: draw.autoSystemId,
      systemOverride: draw.systemOverride,
      participantCount: draw.participants.length,
    }),
  )

  const unreleased = solo.filter((draw) => !draw.publicationState?.boutsReleased)
  const released = solo.filter((draw) => draw.publicationState?.boutsReleased)

  console.log('solo categories total:', solo.length)
  console.log('released:', released.length)
  console.log('unreleased:', unreleased.length)
  if (unreleased.length) {
    console.log('unreleased keys:')
    for (const draw of unreleased) {
      console.log(draw.categoryKey)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
