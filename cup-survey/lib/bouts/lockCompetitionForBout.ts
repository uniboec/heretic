import type { Prisma } from '@prisma/client'
import {
  getActivePublishedDrawByCategoryKey,
  getActivePublishedGeneration,
  type PublishedDrawPair,
} from '../brackets/generation/publishedDraws'

const publishedDrawInclude = {
  generation: true,
  participants: { orderBy: { seedPosition: 'asc' as const } },
} as const

export async function lockCompetitionDrawForCategory(
  tx: Prisma.TransactionClient,
  categoryKey: string,
): Promise<PublishedDrawPair> {
  const generation = await getActivePublishedGeneration(tx)
  if (!generation) {
    throw new Error('Нет активной опубликованной генерации сеток')
  }

  const pair = await getActivePublishedDrawByCategoryKey(generation, categoryKey, tx)
  if (!pair) {
    throw new Error(`Категория ${categoryKey} не найдена в опубликованных сетках`)
  }

  await tx.$executeRaw`
    SELECT id FROM "BracketCategoryDraw"
    WHERE id = ${pair.draw.id}
    FOR UPDATE
  `

  const freshDraw = await tx.bracketCategoryDraw.findUnique({
    where: { id: pair.draw.id },
    include: publishedDrawInclude,
  })

  if (!freshDraw) {
    throw new Error(`Категория ${categoryKey} не найдена в опубликованных сетках`)
  }

  return {
    publicationState: pair.publicationState,
    draw: freshDraw,
  }
}
