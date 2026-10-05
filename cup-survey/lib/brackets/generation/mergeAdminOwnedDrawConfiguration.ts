import type { BracketCategoryDraw, OlympicBronzeMode } from '@prisma/client'

export interface AdminOwnedDrawConfiguration {
  systemOverride: string | null
  bronzeModeOverride: OlympicBronzeMode | null
  drawPolicyId: string | null
  drawPolicyVersion: number | null
  matIndex: number | null
  competitionStage: number
}

export type DrawConfigurationSource = Pick<
  BracketCategoryDraw,
  | 'systemOverride'
  | 'bronzeModeOverride'
  | 'drawPolicyId'
  | 'drawPolicyVersion'
  | 'matIndex'
  | 'competitionStage'
>

export function resolveMatIndexForCategoryKey(input: {
  currentDraftDraw: Pick<BracketCategoryDraw, 'matIndex'> | null | undefined
  activePublishedDraw: Pick<BracketCategoryDraw, 'matIndex'> | null | undefined
}): number | null {
  if (input.currentDraftDraw) return input.currentDraftDraw.matIndex
  if (input.activePublishedDraw) return input.activePublishedDraw.matIndex
  return null
}

export function resolveCompetitionStageForCategoryKey(input: {
  currentDraftDraw: Pick<BracketCategoryDraw, 'competitionStage'> | null | undefined
  activePublishedDraw: Pick<BracketCategoryDraw, 'competitionStage'> | null | undefined
}): number {
  if (input.currentDraftDraw) return input.currentDraftDraw.competitionStage
  if (input.activePublishedDraw) return input.activePublishedDraw.competitionStage
  return 1
}

export function mergeAdminOwnedDrawConfiguration(input: {
  candidate: AdminOwnedDrawConfiguration
  currentDraftDraw: DrawConfigurationSource | null | undefined
  activePublishedDraw: DrawConfigurationSource | null | undefined
}): AdminOwnedDrawConfiguration {
  const { candidate, currentDraftDraw, activePublishedDraw } = input

  return {
    systemOverride: currentDraftDraw?.systemOverride ?? candidate.systemOverride,
    bronzeModeOverride: currentDraftDraw?.bronzeModeOverride ?? candidate.bronzeModeOverride,
    drawPolicyId: currentDraftDraw?.drawPolicyId ?? candidate.drawPolicyId,
    drawPolicyVersion: currentDraftDraw?.drawPolicyVersion ?? candidate.drawPolicyVersion,
    matIndex: resolveMatIndexForCategoryKey({ currentDraftDraw, activePublishedDraw }),
    competitionStage: resolveCompetitionStageForCategoryKey({
      currentDraftDraw,
      activePublishedDraw,
    }),
  }
}
