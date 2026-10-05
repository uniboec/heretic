import type { Prisma } from '@prisma/client'

type TransactionClient = Pick<
  Prisma.TransactionClient,
  'bracketCategoryDraw' | 'bracketPublicationState'
>

/** Removes a category draw when it has no participants left. */
export async function deleteCategoryDrawIfEmpty(
  tx: TransactionClient,
  drawId: string,
  participantCount: number,
): Promise<boolean> {
  if (participantCount > 0) return false

  const draw = await tx.bracketCategoryDraw.findUnique({
    where: { id: drawId },
    select: { id: true, categoryKey: true },
  })
  if (!draw) return false

  await tx.bracketPublicationState.deleteMany({
    where: { categoryKey: draw.categoryKey },
  })
  await tx.bracketCategoryDraw.delete({ where: { id: drawId } })
  return true
}
