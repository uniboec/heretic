/**
 * Выпуск опытных категорий на площадку (без изменения состава).
 */
import { prisma } from '../lib/prisma'
import { setCategoriesBoutsReleased } from '../lib/bouts/release'
import { setCategoriesPublicVisibility } from '../lib/brackets/generation/categoryVisibility'

async function main() {
  const gen = await prisma.bracketGeneration.findFirst({
    where: { status: 'ACTIVE', singletonKey: 'live' },
  })
  if (!gen?.publishedAt) throw new Error('Сетки не опубликованы')

  await prisma.bracketPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })
  await prisma.boutsPageSetting.update({
    where: { id: 'default' },
    data: { publicEnabled: true },
  })

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: gen.id,
      status: 'ACTIVE',
      categoryKey: { contains: ':experienced:' },
    },
    include: { participants: true },
  })

  for (const draw of draws) {
    await setCategoriesPublicVisibility({
      scope: 'category',
      categoryKey: draw.categoryKey,
      visible: true,
    })
  }

  const result = await setCategoriesBoutsReleased({
    scope: 'ready',
    released: true,
    expectedPublishedGenerationId: gen.id,
  })

  console.log('experienced draws:', draws.length)
  console.log('released categories:', result.affectedCategoryKeys?.length ?? 0)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
