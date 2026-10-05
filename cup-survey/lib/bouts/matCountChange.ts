import { Prisma, type BracketCategoryDraw, type BracketGeneration } from '@prisma/client'
import type { BoutsPageSetting } from '@prisma/client'
import { DraftConflictError } from '../brackets/core/errors'
import { hashFingerprint } from '../brackets/core/hash'
import { prisma } from '../prisma'
import {
  getActivePublishedGeneration,
  getCurrentPublishedDraws,
  type PublishedDrawPair,
} from '../brackets/generation/publishedDraws'
import { lockLiveGeneration, resolveWorkingDraftGeneration } from '../brackets/live/generation'
import { extractPlayableBoutsForPair } from './extractForPair'
import {
  assignByBout,
  assignByCategory,
  getEffectiveAutoMatAssignMode,
  isCategoryBatchMode,
} from './autoMatAssign'
import type { AutoMatAssignMode } from './autoMatMode'
import {
  boutLoadWeight,
  createMatLoads,
  sumBoutLoads,
  toMatTimingSettings,
  type MatTimingSettings,
} from './matLoad'
import { accumulateReleasedLoad } from './releasedLoad'
import { BoutsConfigurationError } from './errors'
import { sortBouts } from './sortBouts'
import { toPlayableBouts } from './toPlayableBouts'
import type { InternalBout } from './types'

export type DemotionEntry = {
  categoryKey: string
  matIndex: number
  drawId: string
}

export type FixedDemotionPlan = {
  draftEntries: DemotionEntry[]
  publishedEntries: DemotionEntry[]
  demotionToken: string
}

function sortDemotionEntries(entries: DemotionEntry[]): DemotionEntry[] {
  return [...entries].sort(
    (a, b) => a.categoryKey.localeCompare(b.categoryKey, 'ru') || a.matIndex - b.matIndex,
  )
}

export function computeDemotionToken(input: {
  draftId: string
  draftVersion: number
  activePublishedGenerationId: string | null
  newMatCount: number
  draftEntries: DemotionEntry[]
  publishedEntries: DemotionEntry[]
}): string {
  const draft = sortDemotionEntries(input.draftEntries).map(({ categoryKey, matIndex }) => ({
    categoryKey,
    matIndex,
  }))
  const published = sortDemotionEntries(input.publishedEntries).map(({ categoryKey, matIndex }) => ({
    categoryKey,
    matIndex,
  }))
  return hashFingerprint({
    version: 1,
    draftId: input.draftId,
    draftVersion: input.draftVersion,
    activePublishedGenerationId: input.activePublishedGenerationId,
    newMatCount: input.newMatCount,
    draft,
    published,
  })
}

export function buildFixedDemotionPlan(input: {
  draftId: string
  draftVersion: number
  activePublishedGenerationId: string | null
  newMatCount: number
  draftDraws: BracketCategoryDraw[]
  publishedPairs: PublishedDrawPair[]
}): FixedDemotionPlan {
  const draftEntries = input.draftDraws
    .filter((draw) => draw.matIndex != null && draw.matIndex > input.newMatCount)
    .map((draw) => ({
      categoryKey: draw.categoryKey,
      matIndex: draw.matIndex!,
      drawId: draw.id,
    }))
  const sameLiveGeneration = input.activePublishedGenerationId === input.draftId
  const publishedEntries = sameLiveGeneration
    ? []
    : input.publishedPairs
        .filter((pair) => pair.draw.matIndex != null && pair.draw.matIndex! > input.newMatCount)
        .filter((pair) => !draftEntries.some((entry) => entry.drawId === pair.draw.id))
        .map((pair) => ({
          categoryKey: pair.draw.categoryKey,
          matIndex: pair.draw.matIndex!,
          drawId: pair.draw.id,
        }))
  const demotionToken = computeDemotionToken({
    draftId: input.draftId,
    draftVersion: input.draftVersion,
    activePublishedGenerationId: input.activePublishedGenerationId,
    newMatCount: input.newMatCount,
    draftEntries,
    publishedEntries,
  })
  return { draftEntries, publishedEntries, demotionToken }
}

export async function lockDraftDrawRows(tx: Prisma.TransactionClient, draftId: string) {
  await tx.$executeRaw`
    SELECT id FROM "BracketCategoryDraw"
    WHERE "generationId" = ${draftId}
    FOR UPDATE
  `
}

export async function lockPublishedDrawRows(
  tx: Prisma.TransactionClient,
  publishedGenerationId: string,
) {
  await tx.$executeRaw`
    SELECT id FROM "BracketCategoryDraw"
    WHERE "generationId" = ${publishedGenerationId}
    FOR UPDATE
  `
}

export async function lockActivePublishedGeneration(
  tx: Prisma.TransactionClient,
): Promise<BracketGeneration | null> {
  try {
    return await lockLiveGeneration(tx)
  } catch {
    return null
  }
}

function assertFixedReleaseAllowed(storedMatIndex: number, matCount: number) {
  if (storedMatIndex < 1 || storedMatIndex > matCount) {
    throw new BoutsConfigurationError(
      `Площадка ${storedMatIndex} больше недоступна (matCount=${matCount})`,
    )
  }
}

function buildWeightFn(mode: AutoMatAssignMode, settings: MatTimingSettings) {
  return (bout: Pick<InternalBout, 'categoryKey' | 'id'>) =>
    boutLoadWeight(bout, mode, settings)
}

async function assignAutoMatBatch(
  tx: Prisma.TransactionClient,
  autoBatch: PublishedDrawPair[],
  matCount: number,
  loads: number[],
  effectiveMode: AutoMatAssignMode,
  settings: MatTimingSettings,
) {
  const preparedAutoBatch = autoBatch.map((pair) => ({
    pair,
    bouts: sortBouts(
      toPlayableBouts(extractPlayableBoutsForPair(pair), pair.draw.participants.length),
    ),
  }))

  if (isCategoryBatchMode(effectiveMode)) {
    preparedAutoBatch.sort((a, b) => {
      const aSort =
        effectiveMode === 'BY_CATEGORY_TIME'
          ? sumBoutLoads(a.bouts, settings)
          : a.bouts.length
      const bSort =
        effectiveMode === 'BY_CATEGORY_TIME'
          ? sumBoutLoads(b.bouts, settings)
          : b.bouts.length
      return bSort - aSort || a.pair.draw.categoryKey.localeCompare(b.pair.draw.categoryKey, 'ru')
    })
  } else {
    preparedAutoBatch.sort((a, b) =>
      a.pair.draw.categoryKey.localeCompare(b.pair.draw.categoryKey, 'ru'),
    )
  }

  const weightFn = buildWeightFn(effectiveMode, settings)

  for (const { pair, bouts } of preparedAutoBatch) {
    const assignments = isCategoryBatchMode(effectiveMode)
      ? assignByCategory(bouts, loads, weightFn).assignments
      : assignByBout(bouts, loads, weightFn)

    await tx.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: {
        boutsReleased: true,
        boutMatAssignments: assignments,
        matCountAtRelease: matCount,
      },
    })
  }
}

export async function assignMatForCategoryBatch(
  tx: Prisma.TransactionClient,
  batch: PublishedDrawPair[],
  matCount: number,
  loads: number[],
  effectiveMode: AutoMatAssignMode,
  settings: MatTimingSettings,
) {
  const fixedBatch = batch.filter((pair) => pair.draw.matIndex != null)
  const autoBatch = batch.filter((pair) => pair.draw.matIndex == null)

  for (const pair of fixedBatch) {
    const storedMatIndex = pair.draw.matIndex!
    assertFixedReleaseAllowed(storedMatIndex, matCount)
    const bouts = toPlayableBouts(
      extractPlayableBoutsForPair(pair),
      pair.draw.participants.length,
    )
    const weight = bouts.reduce(
      (sum, bout) => sum + boutLoadWeight(bout, effectiveMode, settings),
      0,
    )
    loads[storedMatIndex - 1] += weight
  }

  await assignAutoMatBatch(tx, autoBatch, matCount, loads, effectiveMode, settings)

  for (const pair of fixedBatch) {
    await tx.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: {
        boutsReleased: true,
        boutMatAssignments: Prisma.DbNull,
        matCountAtRelease: matCount,
      },
    })
  }
}

export async function reassignReleasedMatAssignments(
  tx: Prisma.TransactionClient,
  matCount: number,
  activePublished: BracketGeneration,
  settings: Pick<
    BoutsPageSetting,
    'autoMatAssignMode' | 'autoMatByCategoryEnabled' | 'boutBreakMinutes' | 'ageDivisionDurationOverrides'
  >,
) {
  const releasedPairs = await getCurrentPublishedDraws({
    db: tx,
    activeGeneration: activePublished,
    require: 'boutsReleased',
  })
  if (releasedPairs.length === 0) {
    return {
      recomputedReleasedCategoryCount: 0,
      reassignedAutoCategoryCount: 0,
    }
  }

  const effectiveMode = getEffectiveAutoMatAssignMode(settings)
  const timingSettings = toMatTimingSettings(settings)

  const fixedPairs = releasedPairs.filter((pair) => pair.draw.matIndex != null)
  const autoPairs = releasedPairs.filter((pair) => pair.draw.matIndex == null)

  const loads = createMatLoads(matCount)
  accumulateReleasedLoad(fixedPairs, matCount, loads, effectiveMode, timingSettings)

  await assignAutoMatBatch(tx, autoPairs, matCount, loads, effectiveMode, timingSettings)

  return {
    recomputedReleasedCategoryCount: releasedPairs.length,
    reassignedAutoCategoryCount: autoPairs.length,
  }
}

export async function applyFixedDemotion(
  tx: Prisma.TransactionClient,
  draftEntries: DemotionEntry[],
  publishedEntries: DemotionEntry[],
) {
  let affectedRows = 0
  for (const entry of [...draftEntries, ...publishedEntries]) {
    const result = await tx.bracketCategoryDraw.updateMany({
      where: { id: entry.drawId },
      data: { matIndex: null },
    })
    affectedRows += result.count
  }
  const expectedRows = draftEntries.length + publishedEntries.length
  if (affectedRows !== expectedRows) {
    throw new BoutsConfigurationError(
      `Demotion plan drift: expected ${expectedRows} row updates, got ${affectedRows}`,
    )
  }
}

export function demotedFixedMatsFromEntries(
  draftEntries: DemotionEntry[],
  publishedEntries: DemotionEntry[],
): number[] {
  return [...new Set([...draftEntries, ...publishedEntries].map((entry) => entry.matIndex))].sort(
    (a, b) => a - b,
  )
}

export function hasDemotionConfirmation(input: {
  confirmFixedDemotion?: boolean
  demotionToken?: string
}): boolean {
  return input.confirmFixedDemotion === true || Boolean(input.demotionToken?.length)
}

/** UX-only preview helper — PATCH recomputes under write locks. */
export async function previewMatCountChange(input: {
  newMatCount: number
  draftId: string
  expectedVersion: number
}) {
  const settings = await prisma.boutsPageSetting.findUniqueOrThrow({ where: { id: 'default' } })
  const draft = await resolveWorkingDraftGeneration()
  if (!draft || draft.id !== input.draftId || draft.version !== input.expectedVersion) {
    throw new DraftConflictError()
  }
  const activePublished = await getActivePublishedGeneration()
  const draftDraws = await prisma.bracketCategoryDraw.findMany({
    where: { generationId: draft.id },
  })
  const publishedPairs = activePublished
    ? await getCurrentPublishedDraws({ activeGeneration: activePublished })
    : []
  const plan = buildFixedDemotionPlan({
    draftId: draft.id,
    draftVersion: draft.version,
    activePublishedGenerationId: activePublished?.id ?? null,
    newMatCount: input.newMatCount,
    draftDraws,
    publishedPairs,
  })
  const needsConfirmation = plan.draftEntries.length + plan.publishedEntries.length > 0
  return {
    needsConfirmation,
    demotionToken: needsConfirmation ? plan.demotionToken : null,
    draftEntries: plan.draftEntries.map(({ categoryKey, matIndex }) => ({ categoryKey, matIndex })),
    publishedEntries: plan.publishedEntries.map(({ categoryKey, matIndex }) => ({
      categoryKey,
      matIndex,
    })),
    demotedFixedMats: demotedFixedMatsFromEntries(plan.draftEntries, plan.publishedEntries),
    demotedCategoryCount: plan.draftEntries.length + plan.publishedEntries.length,
    currentMatCount: settings.matCount,
  }
}
