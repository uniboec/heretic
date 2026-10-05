#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const SCHEDULE_NUMS = ['2-4', '2-14', '2-29']
const NAMES = ['Цыкарева', 'Пироженко', 'Очур-Оол']

async function main() {
  const executions = await prisma.boutScheduleExecution.findMany({
    where: { frozenScheduleFormatted: { in: SCHEDULE_NUMS } },
  })
  const categoryKeys = [...new Set(executions.map((e) => e.boutId.split('::')[0]))]

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: { categoryKey: { in: categoryKeys } },
    include: { participants: { orderBy: { seedPosition: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  })
  const drawByKey = new Map<string, typeof draws[number]>()
  for (const draw of draws) {
    if (!drawByKey.has(draw.categoryKey)) drawByKey.set(draw.categoryKey, draw)
  }

  const reports = []

  for (const categoryKey of categoryKeys) {
    const draw = drawByKey.get(categoryKey)
    if (!draw) continue

    const names = draw.participants.map((p) => p.snapshotDisplayName ?? '')
    if (!NAMES.every((n) => names.some((name) => name.includes(n)))) continue

    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
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
    const result = readCategoryResult(structure, systemId, {
      participantCount: draw.participants.length,
      bronzeMode,
    })

    const boutIds = (structure?.rounds ?? []).map((m) => `${categoryKey}::${m.id}`)
    const allExec = await prisma.boutScheduleExecution.findMany({ where: { boutId: { in: boutIds } } })
    const allResults = await prisma.boutResult.findMany({
      where: { boutId: { in: boutIds } },
      orderBy: [{ boutId: 'asc' }, { resultVersion: 'desc' }],
    })
    const allEvents = await prisma.boutEvent.findMany({
      where: { boutId: { in: boutIds } },
      orderBy: { createdAt: 'asc' },
    })

    const name = (id: string | null | undefined) =>
      draw.participants.find((p) => p.entryId === id)?.snapshotDisplayName ?? id
    const seed = (id: string | null | undefined) =>
      draw.participants.find((p) => p.entryId === id)?.seedPosition

    reports.push({
      categoryKey,
      title: getCategoryTitleFromKey(categoryKey),
      systemId,
      participants: draw.participants.map((p) => ({
        seed: p.seedPosition,
        entryId: p.entryId,
        name: p.snapshotDisplayName,
        club: p.snapshotClubName,
      })),
      placements: (result?.placements ?? []).map((p) => ({
        placement: p.placement,
        reason: p.reason,
        name: name(p.entryId),
      })),
      awardQueue: await prisma.awardCeremonyQueue.findUnique({
        where: {
          tournamentScopeId_categoryKey: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            categoryKey,
          },
        },
        select: { status: true, needsReview: true, conflictReason: true },
      }),
      bouts: structure?.rounds.map((m) => {
        const boutId = `${categoryKey}::${m.id}`
        const exec = allExec.find((e) => e.boutId === boutId)
        const current = allResults.find((r) => r.boutId === boutId && r.isCurrent && r.resultStatus === 'ACTIVE')
        const versions = allResults.filter((r) => r.boutId === boutId)
        const events = allEvents.filter((e) => e.boutId === boutId && !e.undoneAt)
        return {
          localId: m.id,
          label: m.label,
          scheduleNum: exec?.frozenScheduleFormatted,
          executionPhase: exec?.boutPhase,
          clockState: exec?.clockState,
          attemptNumber: exec?.attemptNumber,
          structure: {
            a: m.participantA?.entryId
              ? `${seed(m.participantA.entryId)} ${name(m.participantA.entryId)}`
              : m.slotHintA,
            b: m.participantB?.entryId
              ? `${seed(m.participantB.entryId)} ${name(m.participantB.entryId)}`
              : m.slotHintB,
            winner: name(m.winnerEntryId),
            loser: name(m.loserEntryId),
          },
          currentResult: current
            ? {
                version: current.resultVersion,
                winner: name(current.winnerEntryId),
                loser: name(current.loserEntryId),
                method: current.victoryMethod,
                reason: current.decisionReason,
                confirmedAt: current.resultConfirmedAt,
                confirmedBy: current.confirmedBy,
                boutElapsedMs: current.boutElapsedMs,
                details: current.decisionDetails,
              }
            : null,
          resultVersionCount: versions.length,
          invalidatedVersions: versions.filter((r) => !r.isCurrent || r.resultStatus !== 'ACTIVE').length,
          events: events.map((e) => ({
            type: e.eventType,
            at: e.createdAt,
            actor: e.actorId,
            payload: e.payload,
          })),
          hasClockStart: events.some((e) => e.eventType === 'CLOCK_START'),
          hasScoring: events.some((e) => e.eventType === 'TECHNICAL_SCORE'),
        }
      }),
    })
  }

  console.log(JSON.stringify(reports, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => prisma.$disconnect())
