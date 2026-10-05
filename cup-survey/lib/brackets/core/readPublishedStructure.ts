import type { OlympicBronzeMode } from '@prisma/client'
import { structureWithDerivedResult } from '../deriveCategoryPlacements'
import { getSystemForDraw } from './recalculate'
import { deserializePublishedStructure } from './snapshot'
import type { BracketStructure } from './types'

export function readPublishedStructure(input: {
  publishedStructureJson: unknown
  autoSystemId: string | null
  systemOverride: string | null
  systemVersion: number | null
  autoBronzeMode: OlympicBronzeMode | null
  bronzeModeOverride: OlympicBronzeMode | null
  drawSeed: string
  participants: Array<{
    entryId: string
    seedPosition: number
    seedLocked: boolean
    snapshotDisplayName: string | null
    snapshotClubName: string | null
    snapshotCity: string | null
    snapshotPublicNumber: number | null
  }>
  effectiveBronzeMode: OlympicBronzeMode | null
}): BracketStructure | null {
  const snapshot = deserializePublishedStructure(input.publishedStructureJson)
  if (snapshot) {
    return structureWithDerivedResult(snapshot.structure, {
      systemId: snapshot.systemId,
      bronzeMode: input.effectiveBronzeMode,
      participantCount: input.participants.length,
    })
  }

  const system = getSystemForDraw(
    input.autoSystemId,
    input.systemOverride,
    input.systemVersion,
    true,
  )
  if (!system) return null

  const built = system.build({
    participants: input.participants.map((participant) => ({
      entryId: participant.entryId,
      displayName: participant.snapshotDisplayName ?? '',
      clubName: participant.snapshotClubName ?? '',
      city: participant.snapshotCity ?? '',
      clubIdentity: `${participant.snapshotClubName ?? ''}::${participant.snapshotCity ?? ''}`,
      publicNumber: participant.snapshotPublicNumber,
      seedPosition: participant.seedPosition,
      seedLocked: participant.seedLocked,
    })),
    drawSeed: input.drawSeed,
    options: { bronzeMode: input.effectiveBronzeMode },
  })

  return structureWithDerivedResult(built, {
    systemId: system.id,
    bronzeMode: input.effectiveBronzeMode,
    participantCount: input.participants.length,
  })
}
