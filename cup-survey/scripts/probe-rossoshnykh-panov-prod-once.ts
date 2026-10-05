#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { readFullScheduleSnapshot } from '../lib/bouts/scheduleService'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveSystemId } from '../lib/brackets/core/formatRules'

async function findAthletes(lastNames: string[]) {
  return prisma.athlete.findMany({
    where: {
      OR: lastNames.map((lastName) => ({
        lastName: { equals: lastName, mode: 'insensitive' },
      })),
    },
    include: {
      entries: {
        select: {
          id: true,
          discipline: true,
          paymentStatus: true,
        },
      },
    },
  })
}

async function main() {
  const athletes = await findAthletes(['Россошных', 'Панов'])
  const entryIds = new Set(athletes.flatMap((athlete) => athlete.entries.map((entry) => entry.id)))

  const snapshot = await readFullScheduleSnapshot({ adminPreview: true })
  const matchedBouts = []
  for (const mat of snapshot.grouped.mats) {
    for (const bout of mat.bouts) {
      const a = bout.sideA.kind === 'athlete' ? bout.sideA.entryId : null
      const b = bout.sideB.kind === 'athlete' ? bout.sideB.entryId : null
      const touches =
        (a && entryIds.has(a)) || (b && entryIds.has(b))
      if (!touches) continue
      matchedBouts.push({
        id: bout.id,
        categoryKey: bout.categoryKey,
        categoryTitle: bout.categoryTitle,
        matIndex: mat.matIndex,
        scheduleDisplayNumber: bout.scheduleDisplayNumber,
        status: bout.status,
        sideA: bout.sideA,
        sideB: bout.sideB,
        bothTargetAthletes: Boolean(a && b && entryIds.has(a) && entryIds.has(b)),
      })
    }
  }

  const boutIds = matchedBouts.map((bout) => bout.id)
  const [executions, results, draws] = await Promise.all([
    prisma.boutScheduleExecution.findMany({ where: { boutId: { in: boutIds } } }),
    prisma.boutResult.findMany({
      where: { boutId: { in: boutIds }, isCurrent: true },
    }),
    prisma.bracketCategoryDraw.findMany({
      where: {
        categoryKey: {
          in: [...new Set(matchedBouts.map((bout) => bout.categoryKey))],
        },
      },
      include: { participants: true },
    }),
  ])

  const categoryResults = draws.map((draw) => {
    const snapshotStructure = deserializePublishedStructure(draw.publishedStructureJson)
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const result =
      snapshotStructure && systemId
        ? readCategoryResult(snapshotStructure.structure, systemId, {
            participantCount: draw.participants.length,
            bronzeMode: draw.bronzeModeOverride ?? draw.autoBronzeMode,
          })
        : null
    return {
      categoryKey: draw.categoryKey,
      systemId,
      participantCount: draw.participants.length,
      participants: draw.participants.map((p) => p.snapshotDisplayName),
      resultStatus: result?.status ?? null,
      placements: result?.placements ?? [],
    }
  })

  const inProgress = await prisma.boutScheduleExecution.findMany({
    where: {
      boutPhase: { in: ['live', 'pending_confirmation', 'pending_activity_decision'] },
    },
    select: { boutId: true, boutPhase: true },
  })

  console.log(
    JSON.stringify(
      {
        athletes: athletes.map((athlete) => ({
          id: athlete.id,
          name: `${athlete.lastName} ${athlete.firstName}`,
          entries: athlete.entries,
        })),
        matchedBouts,
        executions,
        results,
        categoryResults,
        inProgress,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
