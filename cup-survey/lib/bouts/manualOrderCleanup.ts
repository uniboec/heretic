import type { Prisma } from '@prisma/client'
import { lockBoutsPageSetting } from './locks'
import { getGroupedBoutsForSchedule } from './schedulePipeline'
import {
  diffOverridesForMat,
  mergeCategoryScheduleOverrides,
} from './scheduleOverrideMutations'
import { clearManualOrderForMat } from './scheduleOverrides'
import type { InternalBout } from './types'

async function loadOverridePairs(tx: Prisma.TransactionClient) {
  const { getActivePublishedGeneration, getCurrentPublishedDraws } = await import(
    '../brackets/generation/publishedDraws'
  )
  const published = await getActivePublishedGeneration(tx)
  const pairs = published
    ? await getCurrentPublishedDraws({ db: tx, activeGeneration: published })
    : []
  return pairs
}

async function persistCategoryOverrides(
  tx: Prisma.TransactionClient,
  pairs: Awaited<ReturnType<typeof import('../brackets/generation/publishedDraws').getCurrentPublishedDraws>>,
  categoryOverrides: Map<string, import('./scheduleOverrides').BoutScheduleOverrides>,
) {
  for (const pair of pairs) {
    const patch = categoryOverrides.get(pair.draw.categoryKey)
    if (!patch) continue
    const merged = mergeCategoryScheduleOverrides(pair.publicationState.scheduleOverrides, patch)
    await tx.bracketPublicationState.update({
      where: { categoryKey: pair.draw.categoryKey },
      data: { scheduleOverrides: merged },
    })
  }
}

export async function loadScheduleOverrideContext(tx: Prisma.TransactionClient) {
  const lockedSettings = await lockBoutsPageSetting(tx)
  const grouped = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
    adminPreview: true,
  })
  const pairs = await loadOverridePairs(tx)
  const { buildScheduleOverridesFromPairs } = await import('./schedulePipeline')
  const { normalizeBoutsPageSettings } = await import('./normalizeBoutsPageSettings')
  const { finalizeGroupedWithScheduleOverrides } = await import('./schedulePipeline')
  const rawOverrides =
    grouped.mats.length > 0 ? buildScheduleOverridesFromPairs(pairs, grouped) : {}
  const finalized = finalizeGroupedWithScheduleOverrides(
    grouped,
    rawOverrides,
    lockedSettings.matCount,
  )
  const settings = normalizeBoutsPageSettings(lockedSettings)
  return {
    grouped: finalized.grouped,
    pairs,
    overrides: finalized.overrides,
    settings,
  }
}

export async function clearManualOrderForMats(
  tx: Prisma.TransactionClient,
  matIndexes: number[],
) {
  const unique = [...new Set(matIndexes)].filter((index) => index > 0)
  if (unique.length === 0) return

  const { grouped, pairs, overrides } = await loadScheduleOverrideContext(tx)
  let nextOverrides = overrides
  const touchedBouts: InternalBout[] = []
  for (const matIndex of unique) {
    const mat = grouped.mats.find((entry) => entry.matIndex === matIndex)
    if (!mat) continue
    nextOverrides = clearManualOrderForMat(mat.bouts, nextOverrides)
    touchedBouts.push(...mat.bouts)
  }
  if (touchedBouts.length === 0) return

  const byCategory = diffOverridesForMat(touchedBouts, overrides, nextOverrides)
  await persistCategoryOverrides(tx, pairs, byCategory)
}

function categoryBoutIdsByMat(
  grouped: Awaited<ReturnType<typeof getGroupedBoutsForSchedule>>,
  categoryKey: string,
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>()
  for (const mat of grouped.mats) {
    const ids = new Set(mat.bouts.filter((b) => b.categoryKey === categoryKey).map((b) => b.id))
    if (ids.size > 0) result.set(mat.matIndex, ids)
  }
  return result
}

function setsEqual(a: Set<string> | undefined, b: Set<string> | undefined): boolean {
  const left = a ?? new Set()
  const right = b ?? new Set()
  if (left.size !== right.size) return false
  for (const id of left) {
    if (!right.has(id)) return false
  }
  return true
}

export async function clearManualOrderAfterCategoryCompositionChange(
  tx: Prisma.TransactionClient,
  categoryKey: string,
  beforeGrouped: Awaited<ReturnType<typeof getGroupedBoutsForSchedule>>,
) {
  const lockedSettings = await lockBoutsPageSetting(tx)
  const afterGrouped = await getGroupedBoutsForSchedule(tx, lockedSettings.matCount, {
    adminPreview: true,
  })
  const before = categoryBoutIdsByMat(beforeGrouped, categoryKey)
  const after = categoryBoutIdsByMat(afterGrouped, categoryKey)
  const matsToClear = new Set<number>([...before.keys(), ...after.keys()])
  const changed: number[] = []
  for (const matIndex of matsToClear) {
    if (!setsEqual(before.get(matIndex), after.get(matIndex))) {
      changed.push(matIndex)
    }
  }
  await clearManualOrderForMats(tx, changed)
}

export function clearManualOrderOverridesForBoutIds(
  bouts: InternalBout[],
  boutIds: Set<string>,
  overrides: import('./scheduleOverrides').BoutScheduleOverrides,
): import('./scheduleOverrides').BoutScheduleOverrides {
  const next = { ...overrides }
  for (const bout of bouts) {
    if (!boutIds.has(bout.id)) continue
    if (typeof next[bout.id]?.manualOrder !== 'number') continue
    const { manualOrder: _removed, ...rest } = next[bout.id]!
    if (Object.keys(rest).length === 0) delete next[bout.id]
    else next[bout.id] = rest
  }
  return next
}

export async function clearManualOrderForCategoryStageChange(
  tx: Prisma.TransactionClient,
  input: {
    categoryKey: string
    oldStage: number
    newStage: number
    matIndex: number
  },
) {
  const { grouped, pairs, overrides } = await loadScheduleOverrideContext(tx)
  const mat = grouped.mats.find((entry) => entry.matIndex === input.matIndex)
  if (!mat) return

  const targetIds = new Set(
    mat.bouts
      .filter(
        (b) =>
          b.categoryKey === input.categoryKey &&
          (b.competitionStage === input.oldStage || b.competitionStage === input.newStage),
      )
      .map((b) => b.id),
  )
  if (targetIds.size === 0) return

  const nextOverrides = clearManualOrderOverridesForBoutIds(mat.bouts, targetIds, overrides)
  const touched = mat.bouts.filter((b) => targetIds.has(b.id))
  const byCategory = diffOverridesForMat(touched, overrides, nextOverrides)
  await persistCategoryOverrides(tx, pairs, byCategory)
}
