#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deriveCategoryPlacements } from '../lib/brackets/deriveCategoryPlacements'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_boys_3:m_boys_3_w_le_32'

async function main() {
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { categoryKey: CATEGORY_KEY },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  if (!draw) throw new Error('draw not found')

  const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
  const structure = readPublishedStructure({
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

  const boutIds = (structure?.rounds ?? []).map((m) => `${CATEGORY_KEY}::${m.id}`)
  const [executions, results, events] = await Promise.all([
    prisma.boutScheduleExecution.findMany({ where: { boutId: { in: boutIds } } }),
    prisma.boutResult.findMany({
      where: { boutId: { in: boutIds }, isCurrent: true },
      orderBy: { resultVersion: 'desc' },
    }),
    prisma.boutEvent.findMany({
      where: { boutId: { in: boutIds }, undoneAt: null },
      orderBy: { createdAt: 'asc' },
      select: { boutId: true, eventType: true, createdAt: true },
    }),
  ])

  const name = (id: string | null | undefined) =>
    draw.participants.find((p) => p.entryId === id)?.snapshotDisplayName ?? id

  const result = readCategoryResult(structure, systemId, {
    participantCount: draw.participants.length,
    bronzeMode,
  })
  const derivedFromStored = snapshot?.structure
    ? deriveCategoryPlacements(snapshot.structure, {
        systemId: systemId!,
        bronzeMode,
        participantCount: draw.participants.length,
      })
    : null

  console.log(
    JSON.stringify(
      {
        title: getCategoryTitleFromKey(CATEGORY_KEY),
        systemId,
        participants: draw.participants.map((p) => ({
          seed: p.seedPosition,
          name: p.snapshotDisplayName,
          entryId: p.entryId,
        })),
        bouts: structure?.rounds.map((m) => {
          const boutId = `${CATEGORY_KEY}::${m.id}`
          const exec = executions.find((e) => e.boutId === boutId)
          const br = results.find((r) => r.boutId === boutId && r.isCurrent)
          const boutEvents = events.filter((e) => e.boutId === boutId)
          return {
            id: m.id,
            label: m.label,
            scheduleNum: exec?.frozenScheduleFormatted,
            phase: exec?.boutPhase,
            structureWinner: name(m.winnerEntryId),
            structureLoser: name(m.loserEntryId),
            dbWinner: name(br?.winnerEntryId),
            dbLoser: name(br?.loserEntryId),
            victoryMethod: br?.victoryMethod,
            boutElapsedMs: br?.boutElapsedMs,
            confirmedAt: br?.resultConfirmedAt,
            eventTypes: boutEvents.map((e) => e.eventType),
            hasClockStart: boutEvents.some((e) => e.eventType === 'CLOCK_START'),
          }
        }),
        publicPlacements: result?.placements?.map((p) => ({
          placement: p.placement,
          reason: p.reason,
          name: name(p.entryId),
        })),
        storedSnapshotStatus: snapshot?.structure?.result?.status,
        derivedFromRawStructure: derivedFromStored,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
