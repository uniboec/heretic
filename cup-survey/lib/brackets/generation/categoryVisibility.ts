import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { BracketOperationError } from '../core/errors'
import { acquireBracketWriteLocks } from '../live/locks'
import {
  getActivePublishedGeneration,
  getCurrentPublishedDraws,
} from './publishedDraws'
import {
  ensureLivePublicationPointers,
  listPublicationStatesAfterMutation,
  setPublicationVisibility,
  type PublicationStateDto,
} from './publicationState'
import { resolveVisibilityTargetPairs } from '../admin/publicationTargets'

function resolveCategoryKeys(
  targetPairs: Array<{ draw: { categoryKey: string } }>,
): string[] {
  return targetPairs.map((pair) => pair.draw.categoryKey)
}

export async function setCategoriesPublicVisibility(input: {
  scope: 'all' | 'category'
  categoryKey?: string
  visible: boolean
  /** @deprecated draft mutation removed; accepted for backward compatibility only */
  draftId?: string
  expectedVersion?: number
  /** @deprecated use `visible` */
  publicVisible?: boolean
}): Promise<{
  ok: true
  publicationStates: PublicationStateDto[]
  visible: boolean
  affectedCategoryKeys: string[]
}> {
  const visible = input.visible ?? input.publicVisible ?? false

  const preliminaryCategoryKeys =
    input.scope === 'category' && input.categoryKey ? [input.categoryKey] : undefined

  return prisma.$transaction(
    async (tx) => {
      await acquireBracketWriteLocks(tx, {
        scope: 'minimal',
        categoryKeys: preliminaryCategoryKeys,
      })

      const published = await getActivePublishedGeneration(tx)
      if (!published) {
        throw new BracketOperationError(
          'NO_PUBLISHED_BRACKET',
          'Сначала синхронизируйте состав категорий',
        )
      }

      await ensureLivePublicationPointers(tx, published.id)

      const currentPairs = await getCurrentPublishedDraws({ db: tx, activeGeneration: published })
      if (currentPairs.length === 0) {
        throw new BracketOperationError(
          'NO_PUBLISHED_BRACKET',
          'Нет категорий для показа на сайте',
        )
      }
      const targetPairs = resolveVisibilityTargetPairs({
        scope: input.scope,
        categoryKey: input.categoryKey,
        visible,
        currentPairs,
      })

      if (targetPairs.length === 0) {
        throw new BracketOperationError(
          'INVALID_BODY',
          input.scope === 'category'
            ? 'Категория не найдена'
            : 'Нет категорий для изменения видимости',
        )
      }

      for (const pair of targetPairs) {
        if (pair.draw.status !== 'ACTIVE') {
          throw new BracketOperationError(
            'UNSUPPORTED_CATEGORY',
            `Категория «${pair.draw.title}» не готова к публикации на сайте`,
          )
        }
      }

      await setPublicationVisibility(tx, targetPairs, visible)

      const categoryKeys = resolveCategoryKeys(targetPairs)
      const publicationStates = await listPublicationStatesAfterMutation(tx, categoryKeys)

      return {
        ok: true,
        publicationStates,
        visible,
        affectedCategoryKeys: categoryKeys,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  )
}
