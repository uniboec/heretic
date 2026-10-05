import type { BoutMatAssignments } from './legacyReleaseGate'
import type { GroupedBoutsResult, InternalBout, InternalMatGroup } from './types'

export interface CategoryReleaseGroupingContext {
  boutsReleased: boolean
  storedMatIndex: number | null
  boutMatAssignments: BoutMatAssignments | null
  /** When true, use strict release rules (no silent mat-1 fallback). */
  strictRelease: boolean
}

export function resolveMatCountForGrouping(bouts: InternalBout[], configuredMatCount: number): number {
  const maxAssigned = bouts.reduce(
    (max, bout) => (bout.storedMatIndex != null ? Math.max(max, bout.storedMatIndex) : max),
    0,
  )
  return Math.max(configuredMatCount, maxAssigned, 1)
}

function resolveEffectiveMatIndex(
  bout: InternalBout,
  configuredMatCount: number,
  effectiveMatCount: number,
  context: CategoryReleaseGroupingContext | undefined,
): {
  effectiveMatIndex?: number
  skip?: boolean
  warning?: GroupedBoutsResult['warnings'][number]
} {
  const stored = bout.storedMatIndex

  if (context?.strictRelease && context.boutsReleased) {
    if (stored != null) {
      if (stored < 1 || stored > configuredMatCount) {
        return {
          skip: true,
          warning: {
            code: 'STORED_MAT_INDEX_OUT_OF_RANGE',
            categoryKey: bout.categoryKey,
            boutId: bout.id,
            storedMatIndex: stored,
            matCount: configuredMatCount,
          },
        }
      }
      return { effectiveMatIndex: stored }
    }

    const assignment = context.boutMatAssignments?.[bout.id]
    if (assignment == null || assignment < 1 || assignment > configuredMatCount) {
      return {
        skip: true,
        warning: {
          code: 'AUTO_ASSIGNMENT_MISSING',
          categoryKey: bout.categoryKey,
          boutId: bout.id,
          storedMatIndex: 0,
          matCount: configuredMatCount,
        },
      }
    }
    return { effectiveMatIndex: assignment }
  }

  let effectiveMatIndex = stored ?? 1
  if (stored != null && stored > effectiveMatCount) {
    return {
      effectiveMatIndex: 1,
      warning: {
        code: 'STORED_MAT_INDEX_OUT_OF_RANGE',
        categoryKey: bout.categoryKey,
        boutId: bout.id,
        storedMatIndex: stored,
        matCount: effectiveMatCount,
      },
    }
  }
  return { effectiveMatIndex }
}

export function groupByEffectiveMatIndex(
  bouts: InternalBout[],
  matCount: number,
  releaseContextByCategoryKey?: Map<string, CategoryReleaseGroupingContext>,
): GroupedBoutsResult {
  const effectiveMatCount = resolveMatCountForGrouping(bouts, matCount)
  const warnings: GroupedBoutsResult['warnings'] = []
  const matMap = new Map<number, InternalBout[]>()

  for (const bout of bouts) {
    const context = releaseContextByCategoryKey?.get(bout.categoryKey)
    const { effectiveMatIndex, skip, warning } = resolveEffectiveMatIndex(
      bout,
      matCount,
      effectiveMatCount,
      context,
    )

    if (warning) {
      warnings.push(warning)
      if (!context?.strictRelease && warning.code === 'STORED_MAT_INDEX_OUT_OF_RANGE') {
        console.warn(
          'groupByEffectiveMatIndex: storedMatIndex out of range, falling back to mat 1',
          warning,
        )
      }
    }

    if (skip || effectiveMatIndex == null) {
      continue
    }

    const list = matMap.get(effectiveMatIndex) ?? []
    list.push(bout)
    matMap.set(effectiveMatIndex, list)
  }

  const mats: InternalMatGroup[] = []
  for (let matIndex = 1; matIndex <= effectiveMatCount; matIndex++) {
    mats.push({
      matIndex,
      bouts: matMap.get(matIndex) ?? [],
    })
  }

  return { mats, warnings }
}
