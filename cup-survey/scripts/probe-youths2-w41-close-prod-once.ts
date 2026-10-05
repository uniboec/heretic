#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

const CATEGORY_KEY = 'close_control:experienced:m_youths_2:m_youths_2_w_le_41'

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
  const structure = snapshot?.structure ?? null
  const name = (id: string | null | undefined) =>
    draw.participants.find((p) => p.entryId === id)?.snapshotDisplayName ?? id

  const boutIds = (structure?.rounds ?? []).map((m) => `${CATEGORY_KEY}::${m.id}`)
  const bronzeId = structure?.bronzeSlots?.some((s) => s.id === 'bronze-fight')
    ? `${CATEGORY_KEY}::bronze-fight`
    : null
  const allIds = [...boutIds, ...(bronzeId ? [bronzeId] : [])]

  const [results, executions, award] = await Promise.all([
    prisma.boutResult.findMany({ where: { boutId: { in: allIds }, isCurrent: true } }),
    prisma.boutScheduleExecution.findMany({ where: { boutId: { in: allIds } } }),
    prisma.awardCeremonyQueue.findUnique({
      where: { tournamentScopeId_categoryKey: { tournamentScopeId: 'cup-2026', categoryKey: CATEGORY_KEY } },
      include: { placements: true },
    }),
  ])

  const result = structure && systemId
    ? readCategoryResult(structure, systemId, { participantCount: draw.participants.length, bronzeMode })
    : null

  console.log(
    JSON.stringify(
      {
        categoryKey: CATEGORY_KEY,
        title: getCategoryTitleFromKey(CATEGORY_KEY),
        systemId,
        bronzeMode,
        participants: draw.participants.map((p) => ({
          seed: p.seedPosition,
          entryId: p.entryId,
          name: p.snapshotDisplayName,
        })),
        rounds: structure?.rounds.map((m) => ({
          id: m.id,
          label: m.label,
          a: m.participantA?.entryId ? name(m.participantA.entryId) : m.slotHintA,
          b: m.participantB?.entryId ? name(m.participantB.entryId) : m.slotHintB,
          winner: name(m.winnerEntryId),
          loser: name(m.loserEntryId),
        })),
        bronzeSlots: structure?.bronzeSlots,
        boutResults: results.map((r) => ({
          boutId: r.boutId,
          winner: name(r.winnerEntryId),
          loser: name(r.loserEntryId),
          method: r.victoryMethod,
        })),
        executions: executions.map((e) => ({ boutId: e.boutId, phase: e.boutPhase, num: e.frozenScheduleFormatted })),
        derivedPlacements: result,
        awardQueue: award
          ? {
              status: award.status,
              placements: award.placements.map((p) => ({
                placement: p.placement,
                name: `${p.lastName} ${p.firstName}`.trim(),
              })),
            }
          : null,
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
