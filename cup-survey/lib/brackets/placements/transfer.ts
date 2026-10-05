import type { Prisma } from '@prisma/client'
import { categoryFingerprintForDraw } from '../core/fingerprint'
import { deleteCategoryDrawIfEmpty } from '../core/cleanupEmptyDraw'
import { rebuildDrawAfterCompositionChange } from '../generation/rebuildDraw'
import { computeCategoryDrawSeed } from '../generation/ensureDraft'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import type { BracketFormatRuleLike } from '../core/types'

type TransactionClient = Prisma.TransactionClient

export async function ensureCategoryDraw(
  tx: TransactionClient,
  generationId: string,
  baseSeed: string,
  categoryKey: string,
) {
  const existing = await tx.bracketCategoryDraw.findUnique({
    where: { generationId_categoryKey: { generationId, categoryKey } },
    include: { participants: true },
  })
  if (existing) return existing

  const discipline = categoryKey.split(':')[0]
  return tx.bracketCategoryDraw.create({
    data: {
      generationId,
      categoryKey,
      discipline,
      title: getCategoryTitleFromKey(categoryKey),
      drawSeed: computeCategoryDrawSeed(baseSeed, categoryKey, 0),
      redrawRevision: 0,
    },
    include: { participants: true },
  })
}

export async function removeParticipantFromDraw(
  tx: TransactionClient,
  generationId: string,
  entryId: string,
  rules: BracketFormatRuleLike[],
) {
  const sourceDraw = await tx.bracketCategoryDraw.findFirst({
    where: {
      generationId,
      participants: { some: { entryId } },
    },
    include: { participants: true },
  })
  if (!sourceDraw) return null

  await tx.bracketDrawParticipant.deleteMany({
    where: { drawId: sourceDraw.id, entryId },
  })

  const remaining = sourceDraw.participants.filter((p) => p.entryId !== entryId)
  const remainingCount = remaining.length
  const deleted = await deleteCategoryDrawIfEmpty(tx, sourceDraw.id, remainingCount)
  if (!deleted) {
    const fp = categoryFingerprintForDraw(
      sourceDraw.categoryKey,
      remaining.map((p) => p.entryId),
    )
    await tx.bracketCategoryDraw.update({
      where: { id: sourceDraw.id },
      data: { sourceFingerprint: fp },
    })
    await rebuildDrawAfterCompositionChange(tx, sourceDraw.id, rules, remainingCount)
  }

  return sourceDraw
}

export async function addParticipantToDraw(
  tx: TransactionClient,
  params: {
    generationId: string
    baseSeed: string
    categoryKey: string
    entryId: string
    rules: BracketFormatRuleLike[]
    seedPosition?: number
  },
) {
  const draw = await ensureCategoryDraw(
    tx,
    params.generationId,
    params.baseSeed,
    params.categoryKey,
  )

  const usedPositions = new Set(draw.participants.map((p) => p.seedPosition))
  let seedPosition = params.seedPosition ?? 1
  while (usedPositions.has(seedPosition)) seedPosition++

  await tx.bracketDrawParticipant.upsert({
    where: { drawId_entryId: { drawId: draw.id, entryId: params.entryId } },
    create: {
      drawId: draw.id,
      entryId: params.entryId,
      seedPosition,
      seedLocked: false,
    },
    update: { seedPosition },
  })

  const updatedParticipants = await tx.bracketDrawParticipant.findMany({
    where: { drawId: draw.id },
  })
  const fp = categoryFingerprintForDraw(
    draw.categoryKey,
    updatedParticipants.map((p) => p.entryId),
  )
  await tx.bracketCategoryDraw.update({
    where: { id: draw.id },
    data: { sourceFingerprint: fp },
  })
  await rebuildDrawAfterCompositionChange(tx, draw.id, params.rules, updatedParticipants.length)

  return draw
}
