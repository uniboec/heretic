import { withBasePath } from '@/lib/basePath'
import type { AnnouncerEventType, AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import {
  CUE_SOUNDS,
  getCueSoundEntry,
  resolveCueSoundId,
  type CueSoundDefinition,
} from './cueCatalog'

export type { CueSoundDefinition } from './cueCatalog'
export { CUE_SOUNDS } from './cueCatalog'

export function getCueSound(id: string): CueSoundDefinition | undefined {
  return getCueSoundEntry(id)
}

function isBoutType(type: AnnouncerEventType): boolean {
  return type === 'BOUT_CALL' || type === 'BOUT_PREPARE' || type === 'BOUT_RESULT'
}

export function resolveCueSoundIdForEvent(
  type: AnnouncerEventType,
  settings: AnnouncerSetting,
  rule: AnnouncerRule,
): string {
  const fallbackKind = isBoutType(type) ? 'bout' : 'award'
  if (rule.cueSoundId) {
    return resolveCueSoundId(rule.cueSoundId, fallbackKind)
  }
  const globalId = isBoutType(type) ? settings.boutCueSoundId : settings.awardCueSoundId
  return resolveCueSoundId(globalId, fallbackKind)
}

export function resolveCueForEvent(
  type: AnnouncerEventType,
  settings: AnnouncerSetting,
  rule: AnnouncerRule,
): { soundId: string; url: string; durationMs: number } | null {
  if (!rule.includeCueSound) return null
  const soundId = resolveCueSoundIdForEvent(type, settings, rule)
  const def = getCueSound(soundId)
  if (!def || def.id === 'none' || !def.path) return null
  return { soundId: def.id, url: withBasePath(def.path), durationMs: def.durationMs }
}
