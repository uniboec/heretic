import { getSystemForDraw } from '../recalculate'
import { buildSeedingSnapshot, computeSeedingFingerprint } from '../fingerprint'

export function recomputeSeedingFingerprintForDraw(
  draw: {
    autoSystemId: string | null
    systemOverride: string | null
    systemVersion: number | null
  },
  participants: Array<{ entryId: string; clubIdentity: string; seedPosition: number }>,
): string | null {
  const system = getSystemForDraw(
    draw.autoSystemId,
    draw.systemOverride,
    draw.systemVersion,
    false,
  )
  if (!system) return null

  const snapshot = buildSeedingSnapshot(
    system.id,
    system.version,
    participants.map((participant) => ({
      entryId: participant.entryId,
      clubIdentity: participant.clubIdentity,
      seedPosition: participant.seedPosition,
    })),
  )
  return computeSeedingFingerprint(snapshot)
}
