import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import { lockBoutsPageSetting } from './locks'
import {
  assertProposedScheduleStateAcyclic,
  buildProposedScheduleState,
  diffOverridesForMat,
  renumberManualOrderForMat,
} from './scheduleOverrideMutations'
import { loadScheduleOverrideContext } from './manualOrderCleanup'
import { assertSameStageManualReorder } from './manualOrderValidation'
import { ScheduleConstraintCycleError } from './errors'
import { withScheduleVersionLock } from './scheduleVersion'
import { buildScheduledMats, loadFullScheduleSnapshot } from './scheduleService'
import type { InternalBout } from './types'

export type CompactFrozenPrefixOnMatsResult = {
  dryRun: boolean
  matsTouched: number[]
  reorderedBoutCount: number
  scheduleVersionBefore: number
  scheduleVersionAfter: number
}

export function buildFrozenFirstOrder(
  matBouts: InternalBout[],
  isFrozen: (boutId: string) => boolean,
): string[] {
  const frozen: string[] = []
  const nonFrozen: string[] = []
  for (const bout of matBouts) {
    if (isFrozen(bout.id)) {
      frozen.push(bout.id)
    } else {
      nonFrozen.push(bout.id)
    }
  }
  return [...frozen, ...nonFrozen]
}

export function violatesFrozenPrefix(
  boutIds: string[],
  isFrozen: (boutId: string) => boolean,
): boolean {
  let seenNonFrozen = false
  for (const boutId of boutIds) {
    if (seenNonFrozen && isFrozen(boutId)) {
      return true
    }
    if (!isFrozen(boutId)) {
      seenNonFrozen = true
    }
  }
  return false
}

function countReorderedBouts(originalIds: string[], nextIds: string[]): number {
  let count = 0
  for (let index = 0; index < originalIds.length; index += 1) {
    if (originalIds[index] !== nextIds[index]) {
      count += 1
    }
  }
  return count
}

async function persistCategoryOverrides(
  tx: Prisma.TransactionClient,
  pairs: Awaited<
    ReturnType<typeof import('../brackets/generation/publishedDraws').getCurrentPublishedDraws>
  >,
  categoryOverrides: Map<string, import('./scheduleOverrides').BoutScheduleOverrides>,
) {
  const { mergeCategoryScheduleOverrides } = await import('./scheduleOverrideMutations')
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

async function planCompact(tx: Prisma.TransactionClient) {
  const { grouped, pairs, overrides, settings } = await loadScheduleOverrideContext(tx)
  const fullSnapshot = await loadFullScheduleSnapshot(tx, { adminPreview: true })
  const scheduled = buildScheduledMats({
    grouped: fullSnapshot.grouped,
    snapshot: fullSnapshot,
    now: new Date(),
  })
  const executions = await tx.boutScheduleExecution.findMany({
    select: {
      boutId: true,
      frozenScheduleFormatted: true,
    },
  })
  const isFrozen = (boutId: string) =>
    executions.some((entry) => entry.boutId === boutId && entry.frozenScheduleFormatted != null)

  const groupedByMat = new Map(grouped.mats.map((mat) => [mat.matIndex, mat]))
  let nextOverrides = overrides
  const matsTouched: number[] = []
  let reorderedBoutCount = 0
  const categoryPatches = new Map<string, import('./scheduleOverrides').BoutScheduleOverrides>()

  for (const scheduledMat of scheduled.mats) {
    const groupedMat = groupedByMat.get(scheduledMat.matIndex)
    if (!groupedMat) continue

    const scheduledIds = scheduledMat.bouts.map((bout) => bout.id)
    if (!violatesFrozenPrefix(scheduledIds, isFrozen)) {
      continue
    }

    const scheduledBouts = scheduledIds
      .map((boutId) => groupedMat.bouts.find((bout) => bout.id === boutId))
      .filter((bout): bout is InternalBout => bout != null)
    const nextIds = buildFrozenFirstOrder(scheduledBouts, isFrozen)

    assertSameStageManualReorder(nextIds, groupedMat.bouts)
    const matNextOverrides = renumberManualOrderForMat(groupedMat.bouts, nextIds, nextOverrides)
    const byCategory = diffOverridesForMat(groupedMat.bouts, nextOverrides, matNextOverrides)
    for (const [categoryKey, patch] of byCategory) {
      const existing = categoryPatches.get(categoryKey) ?? {}
      categoryPatches.set(categoryKey, { ...existing, ...patch })
    }
    nextOverrides = matNextOverrides
    matsTouched.push(scheduledMat.matIndex)
    reorderedBoutCount += countReorderedBouts(scheduledIds, nextIds)
  }

  if (matsTouched.length > 0) {
    const proposed = buildProposedScheduleState({
      groupedMats: grouped.mats,
      overrides: nextOverrides,
      settings,
    })
    assertProposedScheduleStateAcyclic(proposed)
  }

  return { matsTouched, reorderedBoutCount, pairs, categoryPatches }
}

export async function compactFrozenPrefixOnMats(input?: {
  dryRun?: boolean
  client?: typeof prisma
}): Promise<CompactFrozenPrefixOnMatsResult> {
  const dryRun = input?.dryRun === true
  const client = input?.client ?? prisma

  const settingsBefore = await client.boutsPageSetting.findUniqueOrThrow({
    where: { id: 'default' },
  })

  if (dryRun) {
    const plan = await client.$transaction((tx) => planCompact(tx))
    return {
      dryRun: true,
      matsTouched: plan.matsTouched,
      reorderedBoutCount: plan.reorderedBoutCount,
      scheduleVersionBefore: settingsBefore.scheduleVersion,
      scheduleVersionAfter: settingsBefore.scheduleVersion,
    }
  }

  let matsTouched: number[] = []
  let reorderedBoutCount = 0
  let scheduleVersionAfter = settingsBefore.scheduleVersion

  await client.$transaction(async (tx) => {
    await lockBoutsPageSetting(tx)
    const currentSettings = await tx.boutsPageSetting.findUniqueOrThrow({
      where: { id: 'default' },
    })

    const plan = await planCompact(tx)
    matsTouched = plan.matsTouched
    reorderedBoutCount = plan.reorderedBoutCount

    if (matsTouched.length === 0) {
      scheduleVersionAfter = currentSettings.scheduleVersion
      return
    }

    const locked = await withScheduleVersionLock(tx, currentSettings.scheduleVersion, async () => {
      await persistCategoryOverrides(tx, plan.pairs, plan.categoryPatches)
      return { result: null, changed: true }
    })
    scheduleVersionAfter = locked.scheduleVersion
  })

  return {
    dryRun: false,
    matsTouched,
    reorderedBoutCount,
    scheduleVersionBefore: settingsBefore.scheduleVersion,
    scheduleVersionAfter,
  }
}
