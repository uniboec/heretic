import { Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
import { loadEligibleEntries } from '../core/eligibility'
import {
  getEffectiveBronzeMode,
  getEffectiveSystemId,
} from '../core/formatRules'
import { BracketSystemRegistry } from '../core/registry'
import { readPublishedStructure } from '../core/readPublishedStructure'
import { serializePublishedStructure } from '../core/snapshot'
import { structureWithDerivedResult } from '../deriveCategoryPlacements'
import { extractBouts } from '../../bouts/extractBouts'
import {
  assertCategoryBoutIdsStable,
  loadExecutionsForBoutIds,
} from '../../bouts/boutIdStability'
import { getCategoryTitleFromKey } from '../../registration/categoryIdentity'
import '../systems'

async function loadSettings() {
  const s = await prisma.bracketPageSetting.findUnique({ where: { id: 'default' } })
  return s ?? { includePaid: true, includeUnpaid: false }
}

export async function recomputeDrawStructure(
  tx: Prisma.TransactionClient,
  drawId: string,
): Promise<void> {
  const draw = await tx.bracketCategoryDraw.findUnique({
    where: { id: drawId },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
  })
  if (!draw || draw.status !== 'ACTIVE') return

  const settings = await loadSettings()
  const eligible = await loadEligibleEntries({
    includePaid: settings.includePaid,
    includeUnpaid: settings.includeUnpaid,
  })
  const eligibleMap = new Map(eligible.map((e) => [e.entryId, e]))

  for (const p of draw.participants) {
    const e = eligibleMap.get(p.entryId)
    await tx.bracketDrawParticipant.update({
      where: { id: p.id },
      data: {
        snapshotDisplayName: e?.displayName ?? p.snapshotDisplayName,
        snapshotClubName: e?.clubName ?? p.snapshotClubName,
        snapshotCity: e?.city ?? p.snapshotCity,
        snapshotPublicNumber: e?.publicNumber ?? p.snapshotPublicNumber,
      },
    })
  }

  const effectiveSystemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  if (!effectiveSystemId || draw.systemVersion == null) return

  const system = BracketSystemRegistry.get(effectiveSystemId, draw.systemVersion)
  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)

  const participants = draw.participants
    .filter((participant) => eligibleMap.has(participant.entryId))
    .map((participant) => {
      const e = eligibleMap.get(participant.entryId)
      return {
        entryId: participant.entryId,
        displayName: e?.displayName ?? participant.snapshotDisplayName ?? '',
        clubName: e?.clubName ?? participant.snapshotClubName ?? '',
        city: e?.city ?? participant.snapshotCity ?? '',
        clubIdentity: `${e?.clubName ?? participant.snapshotClubName ?? ''}::${e?.city ?? participant.snapshotCity ?? ''}`,
        publicNumber: e?.publicNumber ?? participant.snapshotPublicNumber,
        seedPosition: participant.seedPosition,
        seedLocked: participant.seedLocked,
      }
    })

  const previousStructure = readPublishedStructure({
    publishedStructureJson: draw.publishedStructureJson,
    autoSystemId: draw.autoSystemId,
    systemOverride: draw.systemOverride,
    systemVersion: draw.systemVersion,
    autoBronzeMode: draw.autoBronzeMode,
    bronzeModeOverride: draw.bronzeModeOverride,
    drawSeed: draw.drawSeed,
    participants: draw.participants,
    effectiveBronzeMode: bronzeMode,
  })
  const categoryMeta = {
    categoryKey: draw.categoryKey,
    categoryTitle: getCategoryTitleFromKey(draw.categoryKey),
    discipline: draw.discipline,
    storedMatIndex: draw.matIndex ?? null,
    competitionStage: draw.competitionStage,
  }
  const previousBoutIds =
    previousStructure != null
      ? extractBouts(
          previousStructure,
          categoryMeta,
          new Map(
            draw.participants.map((participant) => [
              participant.entryId,
              {
                displayName: participant.snapshotDisplayName ?? '',
                clubName: participant.snapshotClubName ?? '',
                city: participant.snapshotCity ?? '',
                publicNumber: participant.snapshotPublicNumber,
              },
            ]),
          ),
        ).map((bout) => bout.id)
      : []

  const built = system.build({
    participants,
    drawSeed: draw.drawSeed,
    options: { bronzeMode },
  })
  const structure = structureWithDerivedResult(built, {
    systemId: system.id,
    bronzeMode,
    participantCount: participants.length,
  })

  const nextBoutIds = extractBouts(
    structure,
    categoryMeta,
    new Map(
      participants.map((participant) => [
        participant.entryId,
        {
          displayName: participant.displayName,
          clubName: participant.clubName,
          city: participant.city,
          publicNumber: participant.publicNumber,
        },
      ]),
    ),
  ).map((bout) => bout.id)
  const executions = await loadExecutionsForBoutIds(tx, previousBoutIds)
  assertCategoryBoutIdsStable({
    previousBoutIds,
    nextBoutIds,
    executions,
  })

  const serialized = serializePublishedStructure({
    systemId: system.id,
    systemVersion: system.version,
    structure,
  })

  await tx.bracketCategoryDraw.update({
    where: { id: draw.id },
    data: {
      publishedStructureJson: serialized as unknown as Prisma.InputJsonValue,
    },
  })

  const { notifyAwardCeremonyOnStructureFreeze } = await import('../../awards/hooks')
  await notifyAwardCeremonyOnStructureFreeze({
    tx,
    categoryKey: draw.categoryKey,
    publishedStructureJson: serialized,
    participants: draw.participants,
    systemId: system.id,
  })
}

export async function recomputeGenerationStructures(
  tx: Prisma.TransactionClient,
  generationId: string,
): Promise<void> {
  const draws = await tx.bracketCategoryDraw.findMany({
    where: { generationId, status: 'ACTIVE' },
    select: { id: true },
  })
  for (const draw of draws) {
    await recomputeDrawStructure(tx, draw.id)
  }
}
