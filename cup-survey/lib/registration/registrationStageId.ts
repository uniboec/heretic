import { getRegistrationScheduleSync } from './schedule'

/** Legacy registrationStage values from older seeds before schedule IDs were normalized. */
const LEGACY_REGISTRATION_STAGE_ALIASES: Record<string, string> = {
  main: 'regular',
}

export function resolveRegistrationStageId(stageId: string): string {
  const schedule = getRegistrationScheduleSync()
  if (schedule.stagesById[stageId]) return stageId

  const mapped = LEGACY_REGISTRATION_STAGE_ALIASES[stageId]
  if (mapped && schedule.stagesById[mapped]) return mapped

  return stageId
}

export function getStageSortIndex(stageId: string): number {
  const stages = getRegistrationScheduleSync().stages
  const index = stages.findIndex((stage) => stage.id === stageId)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}
