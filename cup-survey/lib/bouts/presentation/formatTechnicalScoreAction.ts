import {
  getTechnicalScoreAction,
  isTechnicalScoreActionId,
  type TechnicalScoreActionId,
} from '@/lib/config/technicalScoreActions'

export function formatTechnicalScoreActionLabel(actionId: TechnicalScoreActionId): string {
  return getTechnicalScoreAction(actionId).label
}

export function formatTechnicalScoreActionShort(actionId: TechnicalScoreActionId): string {
  return getTechnicalScoreAction(actionId).shortLabel
}

export function formatTechnicalScoreActionFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  const action = payload?.action
  if (!isTechnicalScoreActionId(action)) return null
  return formatTechnicalScoreActionLabel(action)
}
