/**
 * P-2b: Reconcile BracketPublicationState pointers with latest PUBLISHED generation.
 * Fixes publishedDrawId drift after partial deploys or manual DB edits.
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
    console.log('No PUBLISHED generation — nothing to reconcile')
    return
  }

  const activeDraws = published.categories.filter((draw) => draw.status === 'ACTIVE')
  const settings = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const pendingKeys = settings?.migrationPendingVisibleKeys ?? []

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const draw of activeDraws) {
    const existing = await prisma.bracketPublicationState.findUnique({
      where: { categoryKey: draw.categoryKey },
    })

    if (!existing) {
      await prisma.bracketPublicationState.create({
        data: {
          id: randomUUID(),
          categoryKey: draw.categoryKey,
          publishedDrawId: draw.id,
          visible: pendingKeys.includes(draw.categoryKey),
        },
      })
      created += 1
      continue
    }

    if (existing.publishedDrawId !== draw.id) {
      await prisma.bracketPublicationState.update({
        where: { categoryKey: draw.categoryKey },
        data: { publishedDrawId: draw.id },
      })
      updated += 1
      console.log(`fixed pointer: ${draw.categoryKey}`)
      continue
    }

    unchanged += 1
  }

  const orphanStates = await prisma.bracketPublicationState.findMany({
    where: {
      publishedDraw: {
        generationId: { not: published.id },
      },
    },
    include: { publishedDraw: true },
  })

  console.log(
    JSON.stringify({
      publishedGenerationId: published.id,
      activeCategories: activeDraws.length,
      created,
      updated,
      unchanged,
      stalePointers: orphanStates.map((state) => state.categoryKey),
    }),
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
