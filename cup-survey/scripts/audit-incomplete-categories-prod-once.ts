#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { getActivePublishedGeneration, getPublicVisiblePublishedDraws } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { readPublishedStructure } from '../lib/brackets/core/readPublishedStructure'
import { readCategoryResult } from '../lib/brackets/core/readCategoryResult'
import { deriveCategoryPlacements } from '../lib/brackets/deriveCategoryPlacements'
import { deserializePublishedStructure } from '../lib/brackets/core/snapshot'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'

async function main() {
  const published = await getActivePublishedGeneration(prisma)
  if (!published) throw new Error('no generation')

  const visiblePairs = await getPublicVisiblePublishedDraws(published)
  const audits = []

  for (const pair of visiblePairs) {
    const draw = pair.draw
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    const storedStructure = snapshot?.structure ?? null

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

    const derivedFresh =
      storedStructure && systemId
        ? deriveCategoryPlacements(storedStructure, {
            systemId,
            bronzeMode,
            participantCount: draw.participants.length,
          })
        : null

    const boutIds = (structure?.rounds ?? []).map((m) => `${draw.categoryKey}::${m.id}`)
    const bronzeIds = (structure?.bronzeSlots ?? []).map((s) => `${draw.categoryKey}::${s.id}`)
    const allBoutIds = [...boutIds, ...bronzeIds]

    const [executions, boutResults] = await Promise.all([
      prisma.boutScheduleExecution.findMany({
        where: { boutId: { in: allBoutIds } },
        select: { boutId: true, boutPhase: true, frozenScheduleFormatted: true },
      }),
      prisma.boutResult.findMany({
        where: { boutId: { in: allBoutIds }, isCurrent: true, resultStatus: 'ACTIVE' },
        select: { boutId: true, winnerEntryId: true, loserEntryId: true },
      }),
    ])

    const nameByEntry = new Map(
      draw.participants.map((p) => [p.entryId, p.snapshotDisplayName ?? p.entryId]),
    )

    const missingResults = allBoutIds.filter((id) => !boutResults.some((r) => r.boutId === id))
    const unconfirmed = executions.filter((e) => e.boutPhase !== 'confirmed')
    const noExecution = allBoutIds.filter((id) => !executions.some((e) => e.boutId === id))

    const reasons: string[] = []
    if (result?.status !== 'complete') {
      if (missingResults.length > 0) reasons.push(`missing_bout_results:${missingResults.length}`)
      if (unconfirmed.length > 0) reasons.push(`unconfirmed_bouts:${unconfirmed.length}`)
      if (noExecution.length > 0) reasons.push(`no_schedule_execution:${noExecution.length}`)
      if (draw.participants.length === 1) reasons.push('single_participant_champion')
      if (
        derivedFresh?.status === 'complete' &&
        result?.status !== 'complete'
      ) {
        reasons.push('stored_result_stale_needs_reconcile')
      }
      if (reasons.length === 0) reasons.push('derive_in_progress_unknown')
    }

    audits.push({
      categoryKey: draw.categoryKey,
      title: getCategoryTitleFromKey(draw.categoryKey),
      discipline: draw.discipline,
      systemId,
      bronzeMode,
      participantCount: draw.participants.length,
      boutCount: allBoutIds.length,
      resultStatus: result?.status ?? null,
      placementCount: result?.placements?.length ?? 0,
      storedResultStatus: storedStructure?.result?.status ?? null,
      derivedFreshStatus: derivedFresh?.status ?? null,
      confirmedBouts: executions.filter((e) => e.boutPhase === 'confirmed').length,
      boutResultsCount: boutResults.length,
      missingResults,
      unconfirmed: unconfirmed.map((e) => ({
        boutId: e.boutId,
        phase: e.boutPhase,
        num: e.frozenScheduleFormatted,
      })),
      noExecution,
      reasons,
      participants: draw.participants.map((p) => p.snapshotDisplayName),
      rounds: structure?.rounds.map((m) => ({
        id: m.id,
        winner: nameByEntry.get(m.winnerEntryId ?? '') ?? m.winnerEntryId,
        loser: nameByEntry.get(m.loserEntryId ?? '') ?? m.loserEntryId,
      })),
    })
  }

  const incomplete = audits.filter((row) => row.resultStatus !== 'complete')
  const complete = audits.filter((row) => row.resultStatus === 'complete')

  console.log(
    JSON.stringify(
      {
        summary: {
          visibleCategories: audits.length,
          complete: complete.length,
          incomplete: incomplete.length,
          reasonBuckets: incomplete.reduce<Record<string, number>>((acc, row) => {
            for (const reason of row.reasons) {
              const key = reason.split(':')[0]
              acc[key] = (acc[key] ?? 0) + 1
            }
            return acc
          }, {}),
        },
        incomplete,
        completeTitles: complete.map((row) => row.title),
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
