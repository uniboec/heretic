import { getSystemForDraw } from '../recalculate'
import {
  buildDrawInputSnapshot,
  buildSeedingSnapshot,
  computeDrawInputFingerprint,
  computeSeedingFingerprint,
} from '../fingerprint'
import { getDefaultDrawPolicy } from './drawPolicy'
import type { BracketParticipantInput } from '../types'

export function recomputeDrawFingerprints(
  draw: {
    autoSystemId: string | null
    systemOverride: string | null
    systemVersion: number | null
    drawPolicyId?: string | null
    drawPolicyVersion?: number | null
  },
  participants: BracketParticipantInput[],
): {
  seedingFingerprint: string | null
  drawInputFingerprint: string | null
  drawPolicyId: string | null
  drawPolicyVersion: number | null
} {
  const system = getSystemForDraw(
    draw.autoSystemId,
    draw.systemOverride,
    draw.systemVersion,
    false,
  )
  if (!system) {
    return {
      seedingFingerprint: null,
      drawInputFingerprint: null,
      drawPolicyId: draw.drawPolicyId ?? null,
      drawPolicyVersion: draw.drawPolicyVersion ?? null,
    }
  }

  const policy = getDefaultDrawPolicy()
  const seedingSnapshot = buildSeedingSnapshot(
    system.id,
    system.version,
    participants.map((participant) => ({
      entryId: participant.entryId,
      clubIdentity: participant.clubIdentity,
      seedPosition: participant.seedPosition,
    })),
  )
  const drawInputSnapshot = buildDrawInputSnapshot(
    draw.drawPolicyId ?? policy.drawPolicyId,
    draw.drawPolicyVersion ?? policy.drawPolicyVersion,
    system.id,
    system.version,
    participants.map((participant) => ({
      entryId: participant.entryId,
      strengthTier: participant.strengthTier ?? null,
      clubKey: participant.clubKey ?? null,
      cityKey: participant.cityKey ?? null,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
  )

  return {
    seedingFingerprint: computeSeedingFingerprint(seedingSnapshot),
    drawInputFingerprint: computeDrawInputFingerprint(drawInputSnapshot),
    drawPolicyId: draw.drawPolicyId ?? policy.drawPolicyId,
    drawPolicyVersion: draw.drawPolicyVersion ?? policy.drawPolicyVersion,
  }
}
