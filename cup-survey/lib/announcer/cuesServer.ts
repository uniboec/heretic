import 'server-only'

import { withBasePath } from '@/lib/basePath'
import type { AnnouncerEventType, AnnouncerRule, AnnouncerSetting } from '@prisma/client'
import { TOURNAMENT_SCOPE_ID } from '@/lib/config/tournament'
import { CUE_SOUNDS, type CueSoundDefinition } from './cueCatalog'
import { getCueSound, resolveCueSoundIdForEvent } from './cues'
import { getCustomCueSound, listCustomCueSounds } from './cueStorage'

export async function listCueSounds(scopeId = TOURNAMENT_SCOPE_ID): Promise<CueSoundDefinition[]> {
  const custom = await listCustomCueSounds(scopeId)
  return [...CUE_SOUNDS, ...custom]
}

export async function getCueSoundById(
  id: string,
  scopeId = TOURNAMENT_SCOPE_ID,
): Promise<CueSoundDefinition | undefined> {
  const builtIn = getCueSound(id)
  if (builtIn) return builtIn
  if (id.startsWith('custom-')) return getCustomCueSound(scopeId, id)
  return undefined
}

export async function resolveCueForEventAsync(
  type: AnnouncerEventType,
  settings: AnnouncerSetting,
  rule: AnnouncerRule,
): Promise<{ soundId: string; url: string; durationMs: number } | null> {
  if (!rule.includeCueSound) return null
  const soundId = resolveCueSoundIdForEvent(type, settings, rule)
  const def = await getCueSoundById(soundId, settings.tournamentScopeId)
  if (!def || def.id === 'none' || !def.path) return null
  return {
    soundId: def.id,
    url: def.path.startsWith('/') ? withBasePath(def.path) : def.path,
    durationMs: def.durationMs,
  }
}
