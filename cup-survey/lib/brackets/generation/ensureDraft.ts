import { ensureLiveGeneration, resolveWorkingDraftGeneration } from '../live/generation'
import { hashDrawSeed } from '../core/hash'

export async function ensureDraftExists(): Promise<{ id: string; version: number }> {
  const working = await resolveWorkingDraftGeneration()
  if (working) return { id: working.id, version: working.version }
  return ensureLiveGeneration()
}

export function computeCategoryDrawSeed(
  baseSeed: string,
  categoryKey: string,
  redrawRevision: number,
): string {
  return hashDrawSeed(baseSeed, categoryKey, redrawRevision)
}
