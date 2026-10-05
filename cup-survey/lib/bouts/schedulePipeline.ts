import type { Prisma } from '@prisma/client'
import {
  getActivePublishedGeneration,
  getBoutsReleasedPublishedDraws,
  getCurrentPublishedDraws,
  getPublicVisiblePublishedDraws,
} from '../brackets/generation/publishedDraws'
import { prisma } from '../prisma'
import { isIndependentBoutsReleaseEnabled } from './config'
import { extractPlayableBoutsForPair } from './extractForPair'
import { groupByEffectiveMatIndex } from './groupByEffectiveMatIndex'
import { parseBoutMatAssignments } from './legacyReleaseGate'
import { sortBouts } from './sortBouts'
import { toPlayableBouts } from './toPlayableBouts'
import { applyMatReassignmentsFromOverrides } from './applyMatReassignments'
import {
  mergeScheduleOverrides,
  parseBoutScheduleOverrides,
  pruneStaleScheduleOverrides,
  sanitizeManualOrderForMat,
  type BoutScheduleOverrides,
} from './scheduleOverrides'
import type { GroupedBoutsResult } from './types'

function buildReleaseContextMap(
  pairs: Awaited<ReturnType<typeof getCurrentPublishedDraws>>,
) {
  const strictRelease = isIndependentBoutsReleaseEnabled()
  const map = new Map<
    string,
    {
      boutsReleased: boolean
      storedMatIndex: number | null
      boutMatAssignments: ReturnType<typeof parseBoutMatAssignments>
      strictRelease: boolean
    }
  >()
  for (const pair of pairs) {
    map.set(pair.draw.categoryKey, {
      boutsReleased: pair.publicationState.boutsReleased,
      storedMatIndex: pair.draw.matIndex ?? null,
      boutMatAssignments: parseBoutMatAssignments(pair.publicationState.boutMatAssignments),
      strictRelease,
    })
  }
  return map
}

export function buildScheduleOverridesFromPairs(
  pairs: Awaited<ReturnType<typeof getCurrentPublishedDraws>>,
  grouped: GroupedBoutsResult,
): BoutScheduleOverrides {
  const merged = mergeScheduleOverrides(
    pairs.map((pair) => parseBoutScheduleOverrides(pair.publicationState.scheduleOverrides)),
  )
  const validIds = new Set(grouped.mats.flatMap((mat) => mat.bouts.map((b) => b.id)))
  let overrides = pruneStaleScheduleOverrides(merged, validIds)
  for (const mat of grouped.mats) {
    overrides = sanitizeManualOrderForMat(mat.bouts, overrides)
  }
  return overrides
}

export function finalizeGroupedWithScheduleOverrides(
  grouped: GroupedBoutsResult,
  overrides: BoutScheduleOverrides,
  matCount: number,
): { grouped: GroupedBoutsResult; overrides: BoutScheduleOverrides } {
  const reassigned = applyMatReassignmentsFromOverrides(grouped, overrides, matCount)
  let nextOverrides = overrides
  for (const mat of reassigned.mats) {
    nextOverrides = sanitizeManualOrderForMat(mat.bouts, nextOverrides)
  }
  return { grouped: reassigned, overrides: nextOverrides }
}

export function buildGroupedBoutsFromPairs(
  pairs: Awaited<ReturnType<typeof getCurrentPublishedDraws>>,
  matCount: number,
): GroupedBoutsResult {
  const releaseContextByCategoryKey = buildReleaseContextMap(pairs)
  let allBouts = pairs.flatMap((pair) =>
    toPlayableBouts(extractPlayableBoutsForPair(pair), pair.draw.participants.length),
  )
  allBouts = sortBouts(allBouts)
  return groupByEffectiveMatIndex(allBouts, matCount, releaseContextByCategoryKey)
}

export async function getGroupedBoutsForSchedule(
  db: Prisma.TransactionClient | undefined,
  matCount: number,
  options?: { adminPreview?: boolean },
): Promise<GroupedBoutsResult> {
  const client = db ?? prisma
  const published = await getActivePublishedGeneration(client)
  if (!published) {
    return { mats: [], warnings: [] }
  }

  const pairs = isIndependentBoutsReleaseEnabled()
    ? options?.adminPreview
      ? await getCurrentPublishedDraws({ db: client, activeGeneration: published })
      : await getBoutsReleasedPublishedDraws(published, client)
    : await getPublicVisiblePublishedDraws(published, client)

  const previewPairs = isIndependentBoutsReleaseEnabled()
    ? options?.adminPreview
      ? pairs.filter((pair) => pair.publicationState.boutsReleased)
      : pairs
    : pairs

  return buildGroupedBoutsFromPairs(previewPairs, matCount)
}
