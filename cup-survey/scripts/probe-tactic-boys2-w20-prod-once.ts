#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'

const CATEGORY_KEY = 'tactic_control:experienced:m_boys_2:m_boys_2_w_le_20'

async function main() {
  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { categoryKey: CATEGORY_KEY },
    include: {
      participants: { orderBy: { seedPosition: 'asc' } },
      publicationState: true,
      generation: { select: { id: true, status: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  if (!draw) throw new Error(`Draw not found: ${CATEGORY_KEY}`)

  const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
  const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const inner = snapshot?.structure ?? null

  const boutIds = (inner?.rounds ?? []).map((m) => `${CATEGORY_KEY}::${m.id}`)
  const bronzeId = inner?.bronzeSlots?.find((s) => s.id === 'bronze-fight')
    ? `${CATEGORY_KEY}::bronze-fight`
    : null
  const allBoutIds = [...boutIds, ...(bronzeId ? [bronzeId] : [])]

  const boutIdFilter =
    allBoutIds.length > 0
      ? { in: allBoutIds }
      : { startsWith: `${CATEGORY_KEY}::` }

  const [results, executions, events] = await Promise.all([
    prisma.boutResult.findMany({
      where: { boutId: boutIdFilter, isCurrent: true },
      orderBy: { boutId: 'asc' },
    }),
    prisma.boutScheduleExecution.findMany({
      where: { boutId: boutIdFilter },
      orderBy: { boutId: 'asc' },
    }),
    prisma.boutEvent.findMany({
      where: {
        boutId: boutIdFilter,
        undoneAt: null,
      },
      orderBy: [{ boutId: 'asc' }, { sequence: 'asc' }],
      select: {
        boutId: true,
        sequence: true,
        eventType: true,
        createdAt: true,
        corner: true,
        payload: true,
      },
    }),
  ])

  const result = inner && systemId
    ? readCategoryResult(inner, systemId, {
        participantCount: draw.participants.length,
        bronzeMode,
      })
    : null

  const nameByEntry = new Map(
    draw.participants.map((p) => [p.entryId, p.snapshotDisplayName ?? p.entryId]),
  )

  console.log(
    JSON.stringify(
      {
        categoryKey: CATEGORY_KEY,
        generationStatus: draw.generation.status,
        systemId,
        bronzeMode,
        participantCount: draw.participants.length,
        participants: draw.participants.map((p) => ({
          seed: p.seedPosition,
          entryId: p.entryId,
          name: p.snapshotDisplayName,
        })),
        visible: draw.publicationState?.visible ?? false,
        boutsReleased: draw.publicationState?.boutsReleased ?? false,
        rounds: inner?.rounds?.map((m) => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          label: m.label ?? null,
          participantA: m.participantA?.entryId
            ? { entryId: m.participantA.entryId, name: nameByEntry.get(m.participantA.entryId) }
            : m.slotHintA,
          participantB: m.participantB?.entryId
            ? { entryId: m.participantB.entryId, name: nameByEntry.get(m.participantB.entryId) }
            : m.slotHintB,
          winnerEntryId: m.winnerEntryId,
          winnerName: m.winnerEntryId ? nameByEntry.get(m.winnerEntryId) : null,
          loserEntryId: m.loserEntryId,
          loserName: m.loserEntryId ? nameByEntry.get(m.loserEntryId) : null,
        })) ?? [],
        bronzeSlots: inner?.bronzeSlots ?? null,
        storedResult: inner?.result ?? null,
        derivedResult: result,
        boutResults: results.map((r) => ({
          boutId: r.boutId,
          winnerEntryId: r.winnerEntryId,
          winnerName: r.winnerEntryId ? nameByEntry.get(r.winnerEntryId) : null,
          loserEntryId: r.loserEntryId,
          loserName: r.loserEntryId ? nameByEntry.get(r.loserEntryId) : null,
          victoryMethod: r.victoryMethod,
          mainRedScore: r.mainRedScore,
          mainBlueScore: r.mainBlueScore,
          officialStartedAt: r.officialEndedAt,
          resultConfirmedAt: r.resultConfirmedAt,
          boutElapsedMs: r.boutElapsedMs,
        })),
        executions: executions.map((e) => ({
          boutId: e.boutId,
          boutPhase: e.boutPhase,
          scheduleNum: e.frozenScheduleFormatted,
          actualStartAt: e.actualStartAt,
          actualEndAt: e.actualEndAt,
          officialStartedAt: e.officialStartedAt,
          officialEndedAt: e.officialEndedAt,
          attemptNumber: e.attemptNumber,
          clockElapsedBeforeStartMs: e.clockElapsedBeforeStartMs,
        })),
        eventSummary: Object.entries(
          events.reduce<Record<string, string[]>>((acc, event) => {
            const list = acc[event.boutId] ?? []
            list.push(event.eventType)
            acc[event.boutId] = list
            return acc
          }, {}),
        ).map(([boutId, types]) => ({ boutId, eventTypes: types })),
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
  .finally(async () => {
    await prisma.$disconnect()
  })
