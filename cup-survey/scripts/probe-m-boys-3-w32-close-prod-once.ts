#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { requireWorkingGeneration } from '../lib/brackets/live/generation'
import { deriveCategoryPlacements } from '../lib/brackets/deriveCategoryPlacements'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
const CATEGORY_KEY = 'close_control:experienced:m_boys_3:m_boys_3_w_le_32'

async function main() {
  const gen = await requireWorkingGeneration(prisma)

  const draw = await prisma.bracketCategoryDraw.findFirst({
    where: { generationId: gen.id, categoryKey: CATEGORY_KEY },
    include: {
      participants: true,
      publicationState: true,
    },
  })
  if (!draw) throw new Error('draw not found')

  const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
  const innerStructure = snapshot?.structure ?? null
  const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
  const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
  const n = draw.participants.length

  const storedResult = innerStructure?.result ?? null
  const readResult =
    innerStructure && systemId
      ? readCategoryResult(innerStructure, systemId, {
          bronzeMode,
          participantCount: n,
        })
      : null

  let derivedFresh = null
  if (innerStructure?.rounds && systemId) {
    try {
      derivedFresh = deriveCategoryPlacements(innerStructure, {
        systemId,
        bronzeMode,
        participantCount: n,
      })
    } catch (error) {
      derivedFresh = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const boutIds = (innerStructure?.rounds ?? []).map((m) => `${CATEGORY_KEY}::${m.id}`)
  const bronzeBoutId = innerStructure?.bronzeSlots?.find((s) => s.id === 'bronze-fight')
    ? `${CATEGORY_KEY}::bronze-fight`
    : null

  const allBoutIds = [...boutIds, ...(bronzeBoutId ? [bronzeBoutId] : [])]
  const results = await prisma.boutResult.findMany({
    where: {
      boutId: allBoutIds.length > 0
        ? { in: allBoutIds }
        : { startsWith: `${CATEGORY_KEY}::` },
      isCurrent: true,
    },
    select: {
      boutId: true,
      winnerEntryId: true,
      loserEntryId: true,
      resultStatus: true,
    },
  })

  const executions = await prisma.boutScheduleExecution.findMany({
    where: {
      boutId: allBoutIds.length > 0
        ? { in: allBoutIds }
        : { startsWith: `${CATEGORY_KEY}::` },
    },
    select: {
      boutId: true,
      boutPhase: true,
      frozenScheduleFormatted: true,
    },
  })

  const placements = await prisma.bracketEntryPlacement.findMany({
    where: {
      categoryKey: CATEGORY_KEY,
      entryId: { in: draw.participants.map((p) => p.entryId) },
    },
  })

  console.log(
    JSON.stringify(
      {
        categoryKey: CATEGORY_KEY,
        generationId: gen.id,
        drawId: draw.id,
        autoSystemId: draw.autoSystemId,
        systemOverride: draw.systemOverride,
        effectiveSystemId: systemId,
        autoBronzeMode: draw.autoBronzeMode,
        bronzeModeOverride: draw.bronzeModeOverride,
        effectiveBronzeMode: bronzeMode,
        participantCount: n,
        participants: draw.participants.map((p) => ({
          entryId: p.entryId,
          seedPosition: p.seedPosition,
          name: p.snapshotDisplayName,
        })),
        hasPublishedStructure: Boolean(snapshot),
        structureSystemId: innerStructure?.systemId ?? null,
        storedResult,
        readResult,
        derivedFresh,
        structureSummary: innerStructure?.rounds
          ? {
              systemId: innerStructure.systemId,
              roundCount: innerStructure.rounds.length,
              rounds: innerStructure.rounds.map((m) => ({
                id: m.id,
                round: m.round,
                matchNumber: m.matchNumber,
                participantA: m.participantA?.entryId ?? null,
                participantB: m.participantB?.entryId ?? null,
                winnerEntryId: m.winnerEntryId ?? null,
                loserEntryId: m.loserEntryId ?? null,
                slotHintA: m.slotHintA ?? null,
                slotHintB: m.slotHintB ?? null,
              })),
              bronzeSlots: innerStructure.bronzeSlots ?? null,
            }
          : null,
        boutResults: results,
        scheduleExecutions: executions,
        storedPlacements: placements,
        visible: draw.publicationState?.visible ?? false,
        boutsReleased: draw.publicationState?.boutsReleased ?? false,
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
