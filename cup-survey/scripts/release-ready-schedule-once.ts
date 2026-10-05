/**
 * Выпуск всех готовых категорий в расписание (поединки + награждение для одиночных).
 */
import { prisma } from '../lib/prisma'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'

async function main() {
  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen?.publishedAt) {
    throw new Error('Сетки не опубликованы')
  }

  const result = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: gen.id,
  })

  console.log('released categories:', result.affectedCategoryKeys?.length ?? 0)
  if (result.affectedCategoryKeys?.length) {
    console.log(result.affectedCategoryKeys.join('\n'))
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
