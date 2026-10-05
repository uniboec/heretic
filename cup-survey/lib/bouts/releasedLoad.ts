import type { PublishedDrawPair } from '../brackets/generation/publishedDraws'
import { boutLoadWeight, type MatTimingSettings } from './matLoad'
import type { AutoMatAssignMode } from './autoMatMode'
import { extractPlayableBoutsForPair } from './extractForPair'
import { parseBoutMatAssignments } from './legacyReleaseGate'
import { toPlayableBouts } from './toPlayableBouts'
import { BoutsConfigurationError } from './errors'

function assertMatInRange(mat: number | null | undefined, matCount: number, context: string) {
  if (mat == null || mat < 1 || mat > matCount) {
    throw new BoutsConfigurationError(
      `Некорректная конфигурация площадок (${context}): mat=${mat}, matCount=${matCount}`,
    )
  }
}

export function accumulateReleasedLoad(
  pairs: PublishedDrawPair[],
  matCount: number,
  loads: number[],
  mode: AutoMatAssignMode,
  settings: MatTimingSettings,
  excludeCategoryKeys?: Set<string>,
) {
  for (const pair of pairs) {
    if (excludeCategoryKeys?.has(pair.draw.categoryKey)) {
      continue
    }

    const bouts = toPlayableBouts(
      extractPlayableBoutsForPair(pair),
      pair.draw.participants.length,
    )
    const storedMatIndex = pair.draw.matIndex

    if (storedMatIndex != null) {
      assertMatInRange(storedMatIndex, matCount, pair.draw.categoryKey)
      const weight = bouts.reduce(
        (sum, bout) => sum + boutLoadWeight(bout, mode, settings),
        0,
      )
      loads[storedMatIndex - 1] += weight
      continue
    }

    const assignments = parseBoutMatAssignments(pair.publicationState.boutMatAssignments)
    for (const bout of bouts) {
      const assignment = assignments?.[bout.id]
      assertMatInRange(assignment, matCount, `${pair.draw.categoryKey}:${bout.id}`)
      loads[assignment! - 1] += boutLoadWeight(bout, mode, settings)
    }
  }
}
