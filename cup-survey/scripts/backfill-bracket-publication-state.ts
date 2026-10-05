/**
 * P-2 / P-5: Backfill BracketPublicationState from latest PUBLISHED generation.
 * Visibility intent before first publish is stored in migrationPendingVisibleKeys (one-time).
 */
import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma'

async function main() {
  const published = await prisma.bracketGeneration.findFirst({
    where: { singletonKey: 'live', status: 'ACTIVE' },
    orderBy: { publishedAt: 'desc' },
    include: { categories: true },
  })

  if (!published) {
    console.log('No PUBLISHED generation — backfill skipped')
    return
  }

  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const pendingKeys = settings?.migrationPendingVisibleKeys ?? []

  for (const draw of published.categories) {
    if (draw.status !== 'ACTIVE') continue

    const existing = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw.categoryKey },
    })

    await prisma.bracketPublicationState.upsert({
      where: { categoryKey: draw.categoryKey },
      create: {
        id: randomUUID(),
        categoryKey: draw.categoryKey,
        publishedDrawId: draw.id,
        visible: pendingKeys.includes(draw.categoryKey),
      },
      update: {
        publishedDrawId: draw.id,
      },
    })
  }

  console.log(`Backfilled publication state for ${published.categories.length} categories`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
