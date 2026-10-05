import type { BracketSeedingSnapshot, DrawInputSnapshot } from './types'
import { hashFingerprint } from './hash'
import type { EligibleEntry } from './types'

export function computeSourceCompositionFingerprint(
  entries: EligibleEntry[],
): string {
  const payload = entries
    .map((e) => ({
      entryId: e.entryId,
      sourceCategoryKey: e.sourceCategoryKey,
    }))
    .sort((a, b) => a.entryId.localeCompare(b.entryId))
  return hashFingerprint({ generation: 1, entries: payload })
}

export interface CategoryCompositionEntry {
  entryId: string
  effectiveCategoryKey: string
}

export function computeCategoryCompositionFingerprint(
  entries: CategoryCompositionEntry[],
): string {
  const payload = [...entries].sort((a, b) => a.entryId.localeCompare(b.entryId))
  return hashFingerprint({ entries: payload })
}

export function categoryFingerprintForDraw(
  categoryKey: string,
  entryIds: string[],
): string {
  return computeCategoryCompositionFingerprint(
    entryIds.map((entryId) => ({ entryId, effectiveCategoryKey: categoryKey })),
  )
}

export function computeSeedingFingerprint(snapshot: BracketSeedingSnapshot): string {
  const participants = [...snapshot.participants].sort((a, b) => {
    if (a.seedPosition !== b.seedPosition) return a.seedPosition - b.seedPosition
    return a.entryId.localeCompare(b.entryId)
  })
  return hashFingerprint({
    systemId: snapshot.systemId,
    systemVersion: snapshot.systemVersion,
    participants,
  })
}

export function buildSeedingSnapshot(
  systemId: string,
  systemVersion: number,
  participants: Array<{ entryId: string; clubIdentity: string; seedPosition: number }>,
): BracketSeedingSnapshot {
  return {
    systemId,
    systemVersion,
    participants: participants.map((p) => ({
      entryId: p.entryId,
      clubIdentity: p.clubIdentity,
      seedPosition: p.seedPosition,
    })),
  }
}

export function buildDrawInputSnapshot(
  drawPolicyId: string,
  drawPolicyVersion: number,
  systemId: string,
  systemVersion: number,
  participants: Array<{
    entryId: string
    strengthTier: number | null
    clubKey: string | null
    cityKey: string | null
    seedPosition: number
    seedLocked: boolean
  }>,
): DrawInputSnapshot {
  return {
    drawPolicyId,
    drawPolicyVersion,
    systemId,
    systemVersion,
    participants: participants.map((participant) => ({
      entryId: participant.entryId,
      strengthTier: participant.strengthTier,
      clubKey: participant.clubKey,
      cityKey: participant.cityKey,
      drawPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
  }
}

export function computeDrawInputFingerprint(snapshot: DrawInputSnapshot): string {
  const participants = [...snapshot.participants].sort((a, b) => a.entryId.localeCompare(b.entryId))
  return hashFingerprint({ ...snapshot, participants })
}
