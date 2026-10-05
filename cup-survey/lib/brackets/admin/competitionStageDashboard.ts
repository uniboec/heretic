import { buildCompetitionStageEligibility } from '../../bouts/competitionStageEligibility'
import { collectConfiguredCategoryStages } from '../../bouts/competitionStages'
import { buildScheduledMats, readFullScheduleSnapshot } from '../../bouts/scheduleService'
import type { DraftCategory } from './mapCategoryMetadata'

export type CategoryStageEligibilityMap = Record<string, Record<number, boolean>>

export async function loadCategoryStageEligibility(
  categories: DraftCategory[],
): Promise<CategoryStageEligibilityMap | null> {
  try {
    const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
    if (!snapshot.published || snapshot.grouped.mats.length === 0) {
      return null
    }

    const scheduled = buildScheduledMats({
      grouped: snapshot.grouped,
      snapshot,
      now: new Date(),
    })
    const allBouts = scheduled.mats.flatMap((mat) => mat.bouts)
    const configuredCategoryStages = collectConfiguredCategoryStages(categories)
    const result: CategoryStageEligibilityMap = {}

    for (const draw of categories) {
      const categoryBouts = snapshot.grouped.mats
        .flatMap((mat) => mat.bouts)
        .filter((bout) => bout.categoryKey === draw.categoryKey)
      result[draw.categoryKey] = buildCompetitionStageEligibility({
        categoryKey: draw.categoryKey,
        categoryBouts,
        allBouts,
        executions: snapshot.executions,
        configuredCategoryStages,
        stageSettings: snapshot.settings.competitionStageSettings,
      })
    }

    return result
  } catch {
    return null
  }
}

export function getConfiguredCategoryStagesFromDraws(
  categories: Array<{ competitionStage: number }>,
): number[] {
  return collectConfiguredCategoryStages(categories)
}
