import { Prisma } from '@prisma/client'
import type { Prisma as PrismaTypes } from '@prisma/client'
import { prisma } from '../../prisma'
import { isIndependentBoutsReleaseEnabled } from '../../bouts/config'
import { resolvePublicGeneration } from '../live/generation'
import { extractPlayableBoutsForPair } from '../../bouts/extractForPair'
import { computeLegacyReleaseFields } from '../../bouts/legacyReleaseGate'
import { toPlayableBouts } from '../../bouts/toPlayableBouts'
import type { PublishedDrawPair } from './publishedDraws'

export interface PublicationStateDto {
  categoryKey: string
  visible: boolean
  boutsReleased: boolean
  matCountAtRelease: number | null
  publishedDrawId: string | null
  publishedGenerationId: string | null
  controlsEnabled: boolean
  repairRequired?: boolean
}

/** Ensure publication rows exist for all ACTIVE live draws (no separate publish step). */
export async function ensureLivePublicationPointers(
  tx: PrismaTypes.TransactionClient,
  generationId: string,
): Promise<void> {
  const activeDraws = await tx.bracketCategoryDraw.findMany({
    where: { generationId, status: 'ACTIVE' },
    select: { id: true, categoryKey: true },
  })

  for (const draw of activeDraws) {
    const existing = await tx.bracketPublicationState.findUnique({
      where: { categoryKey: draw.categoryKey },
    })
    if (!existing) {
      await tx.bracketPublicationState.create({
        data: {
          categoryKey: draw.categoryKey,
          visible: false,
          boutsReleased: false,
          publishedDraw: { connect: { id: draw.id } },
        },
      })
      continue
    }

    if (existing.publishedDrawId !== draw.id) {
      await tx.bracketPublicationState.update({
        where: { categoryKey: draw.categoryKey },
        data: {
          publishedDraw: { connect: { id: draw.id } },
          boutsReleased: false,
          boutMatAssignments: Prisma.DbNull,
          matCountAtRelease: null,
        },
      })
    }
  }

  await resetPublicationStatesAbsentFromSnapshot(
    tx,
    activeDraws.map((draw) => draw.categoryKey),
  )
}

export async function upsertPublicationPointer(
  tx: PrismaTypes.TransactionClient,
  categoryKey: string,
  publishedDrawId: string,
  visibleForNewRow = false,
) {
  const draw = await tx.bracketCategoryDraw.findUnique({ where: { id: publishedDrawId } })
  if (!draw || draw.categoryKey !== categoryKey) {
    throw new Error(`Publication pointer category mismatch for ${categoryKey}`)
  }

  const existing = await tx.bracketPublicationState.findUnique({
    where: { categoryKey },
  })
  if (existing) {
    await tx.bracketPublicationState.update({
      where: { categoryKey },
      data: {
        publishedDraw: { connect: { id: publishedDrawId } },
        visible: false,
        boutsReleased: false,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: null,
      },
    })
    return
  }

  const settings = await tx.bracketPageSetting.findUnique({ where: { id: 'default' } })
  const pendingKeys = settings?.migrationPendingVisibleKeys ?? []
  const visible = visibleForNewRow || pendingKeys.includes(categoryKey)

  await tx.bracketPublicationState.create({
    data: {
      categoryKey,
      visible,
      boutsReleased: false,
      publishedDraw: { connect: { id: publishedDrawId } },
    },
  })

  if (pendingKeys.includes(categoryKey)) {
    await tx.bracketPageSetting.update({
      where: { id: 'default' },
      data: {
        migrationPendingVisibleKeys: pendingKeys.filter((key) => key !== categoryKey),
      },
    })
  }
}

export async function resetPublicationStatesAbsentFromSnapshot(
  tx: PrismaTypes.TransactionClient,
  publishedCategoryKeys: string[],
) {
  const data = {
    visible: false,
    boutsReleased: false,
    boutMatAssignments: Prisma.DbNull,
    matCountAtRelease: null,
  }
  if (publishedCategoryKeys.length === 0) {
    await tx.bracketPublicationState.updateMany({ data })
    return
  }
  await tx.bracketPublicationState.updateMany({
    where: { categoryKey: { notIn: publishedCategoryKeys } },
    data,
  })
}

async function syncReleaseFieldsForVisibility(
  tx: PrismaTypes.TransactionClient,
  pair: PublishedDrawPair,
  visible: boolean,
) {
  if (isIndependentBoutsReleaseEnabled()) {
    return
  }

  const settings = await tx.boutsPageSetting.findUnique({ where: { id: 'default' } })
  const matCount = settings?.matCount ?? 1
  const autoBoutIds = toPlayableBouts(
    extractPlayableBoutsForPair(pair),
    pair.draw.participants.length,
  ).map((bout) => bout.id)

  const releaseFields = computeLegacyReleaseFields({
    visible,
    storedMatIndex: pair.draw.matIndex ?? null,
    matCount,
    autoBoutIds,
  })

  await tx.bracketPublicationState.update({
    where: { categoryKey: pair.draw.categoryKey },
    data: {
      boutsReleased: releaseFields.boutsReleased,
      boutMatAssignments: releaseFields.boutMatAssignments ?? Prisma.DbNull,
      matCountAtRelease: releaseFields.matCountAtRelease,
    },
  })
}

export async function setPublicationVisibility(
  tx: PrismaTypes.TransactionClient,
  pairs: PublishedDrawPair[],
  visible: boolean,
) {
  for (const pair of pairs) {
    await tx.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: { visible },
    })
    await syncReleaseFieldsForVisibility(tx, pair, visible)
  }
}

export async function hasPublishedGeneration(tx: Prisma.TransactionClient): Promise<boolean> {
  return Boolean(await resolvePublicGeneration(tx))
}

function mapStateToDto(
  state: {
    categoryKey: string
    visible: boolean
    boutsReleased: boolean
    matCountAtRelease: number | null
    publishedDrawId: string
    publishedDraw: { generationId: string }
  },
  controlsEnabled: boolean,
): PublicationStateDto {
  return {
    categoryKey: state.categoryKey,
    visible: state.visible,
    boutsReleased: state.boutsReleased,
    matCountAtRelease: state.matCountAtRelease,
    publishedDrawId: state.publishedDrawId,
    publishedGenerationId: state.publishedDraw.generationId,
    controlsEnabled,
  }
}

export async function loadPublicationStateMap(): Promise<Map<string, PublicationStateDto>> {
  const published = await resolvePublicGeneration()
  const controlsEnabled = Boolean(published)

  const states = await prisma.bracketPublicationState.findMany({
    include: {
      publishedDraw: { select: { generationId: true } },
    },
  })

  return new Map(
    states.map((state) => [
      state.categoryKey,
      mapStateToDto(state, controlsEnabled),
    ]),
  )
}

export function publicationStateForCategory(
  categoryKey: string,
  map: Map<string, PublicationStateDto>,
  controlsEnabled: boolean,
): PublicationStateDto {
  const existing = map.get(categoryKey)
  if (existing) return existing
  return {
    categoryKey,
    visible: false,
    boutsReleased: false,
    matCountAtRelease: null,
    publishedDrawId: null,
    publishedGenerationId: null,
    controlsEnabled,
  }
}

export async function listPublicationStatesAfterMutation(
  tx: PrismaTypes.TransactionClient,
  categoryKeys: string[],
): Promise<PublicationStateDto[]> {
  const published = await resolvePublicGeneration(tx)
  const controlsEnabled = Boolean(published)

  const states = await tx.bracketPublicationState.findMany({
    where: { categoryKey: { in: categoryKeys } },
    include: { publishedDraw: { select: { generationId: true } } },
  })

  return categoryKeys.map((categoryKey) => {
    const state = states.find((item) => item.categoryKey === categoryKey)
    if (!state) {
      return publicationStateForCategory(categoryKey, new Map(), controlsEnabled)
    }
    return mapStateToDto(state, controlsEnabled)
  })
}
