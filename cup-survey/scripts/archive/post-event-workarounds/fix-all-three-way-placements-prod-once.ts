#!/usr/bin/env npx tsx
process.env.CUP_SURVEY_SCRIPT_MODE = '1'
/**
 * Re-derive placements for all completed three_way categories and enqueue awards.
 * Touches only BracketCategoryDraw + AwardCeremonyQueue; does not affect mat sessions.
 */
import { prisma } from '../lib/prisma'
import { TOURNAMENT_SCOPE_ID } from '../lib/config/tournament'
import { lockCompetitionDrawForCategory } from '../lib/bouts/lockCompetitionForBout'
import { getActivePublishedGeneration } from '../lib/brackets/generation/publishedDraws'
import { getEffectiveBronzeMode, getEffectiveSystemId } from '../lib/brackets/core/formatRules'
import { deserializePublishedStructure, serializePublishedStructure } from '../lib/brackets/core/snapshot'
import { structureWithDerivedResult } from '../lib/brackets/deriveCategoryPlacements'
import { getCategoryTitleFromKey } from '../lib/registration/categoryIdentity'
import type { CategoryPlacement, CategoryResult } from '../lib/brackets/core/types'

function parseDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? '',
    firstName: parts[1] ?? '',
    middleName: parts.length > 2 ? parts.slice(2).join(' ') : null,
  }
}

function buildPlacementRows(
  result: CategoryResult,
  participants: Array<{ entryId: string; snapshotDisplayName: string | null; snapshotClubName: string | null }>,
) {
  const placements = [...result.placements].sort((a, b) => a.placement - b.placement)
  return placements.map((placement: CategoryPlacement, placementIndex) => {
    const participant = participants.find((row) => row.entryId === placement.entryId)
    const names = parseDisplayName(participant?.snapshotDisplayName ?? placement.entryId)
    return {
      entryId: placement.entryId,
      placement: placement.placement,
      placementIndex,
      lastName: names.lastName,
      firstName: names.firstName,
      middleName: names.middleName,
      clubName: participant?.snapshotClubName ?? '',
    }
  })
}

async function main() {
  const generation = await getActivePublishedGeneration(prisma)
  if (!generation) throw new Error('No active published generation')

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: {
      generationId: generation.id,
      status: 'ACTIVE',
      OR: [{ autoSystemId: 'three_way' }, { systemOverride: 'three_way' }],
    },
    include: { participants: true },
    orderBy: { categoryKey: 'asc' },
  })

  const fixed: Array<Record<string, unknown>> = []
  const skipped: Array<Record<string, unknown>> = []

  for (const draw of draws) {
    const systemId = getEffectiveSystemId(draw.autoSystemId, draw.systemOverride)
    if (systemId !== 'three_way') {
      skipped.push({ categoryKey: draw.categoryKey, reason: 'not_three_way' })
      continue
    }

    const snapshot = deserializePublishedStructure(draw.publishedStructureJson)
    if (!snapshot) {
      skipped.push({ categoryKey: draw.categoryKey, reason: 'no_snapshot' })
      continue
    }

    const boutIds = (snapshot.structure.rounds ?? []).map((m) => `${draw.categoryKey}::${m.id}`)
    const executions = await prisma.boutScheduleExecution.findMany({
      where: { boutId: { in: boutIds } },
      select: { boutId: true, boutPhase: true },
    })
    const allConfirmed =
      boutIds.length > 0 && executions.length === boutIds.length &&
      executions.every((row) => row.boutPhase === 'confirmed')

    if (!allConfirmed) {
      skipped.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        reason: 'bouts_not_complete',
        confirmed: executions.filter((row) => row.boutPhase === 'confirmed').length,
        total: boutIds.length,
      })
      continue
    }

    const bronzeMode = getEffectiveBronzeMode(draw.autoBronzeMode, draw.bronzeModeOverride)
    const structure = structureWithDerivedResult(snapshot.structure, {
      systemId,
      bronzeMode,
      participantCount: draw.participants.length,
    })
    const nextResult = structure.result
    if (!nextResult || nextResult.status !== 'complete' || nextResult.placements.length !== 3) {
      skipped.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        reason: 'derive_not_complete',
        result: nextResult,
      })
      continue
    }

    const alreadyComplete =
      snapshot.structure.result?.status === 'complete' &&
      (snapshot.structure.result?.placements?.length ?? 0) === 3

    await prisma.$transaction(async (tx) => {
      if (!alreadyComplete) {
        const pair = await lockCompetitionDrawForCategory(tx, draw.categoryKey)
        const serialized = serializePublishedStructure({
          systemId: snapshot.systemId,
          systemVersion: snapshot.systemVersion,
          structure,
        })
        await tx.bracketCategoryDraw.update({
          where: { id: pair.draw.id },
          data: { publishedStructureJson: serialized },
        })
      }

      const existing = await tx.awardCeremonyQueue.findUnique({
        where: {
          tournamentScopeId_categoryKey: {
            tournamentScopeId: TOURNAMENT_SCOPE_ID,
            categoryKey: draw.categoryKey,
          },
        },
      })

      let awardEnqueued = false
      if (!existing) {
        const placementRows = buildPlacementRows(nextResult, draw.participants)
        if (placementRows.length > 0) {
          const maxOrder = await tx.awardCeremonyQueue.findFirst({
            where: {
              tournamentScopeId: TOURNAMENT_SCOPE_ID,
              queueGroup: 'NORMAL',
              status: { in: ['PENDING', 'SUSPENDED'] },
            },
            orderBy: { queueOrder: 'desc' },
            select: { queueOrder: true },
          })
          const now = new Date()
          await tx.awardCeremonyQueue.create({
            data: {
              tournamentScopeId: TOURNAMENT_SCOPE_ID,
              categoryKey: draw.categoryKey,
              status: 'PENDING',
              queueGroup: 'NORMAL',
              queueOrder: (maxOrder?.queueOrder ?? -1) + 1,
              completedAtCategory: now,
              placements: {
                create: placementRows,
              },
            },
          })
          await tx.awardsPageSetting.update({
            where: { tournamentScopeId: TOURNAMENT_SCOPE_ID },
            data: { queueRevision: { increment: 1 } },
          })
          awardEnqueued = true
        }
      }

      fixed.push({
        categoryKey: draw.categoryKey,
        title: getCategoryTitleFromKey(draw.categoryKey),
        structureUpdated: !alreadyComplete,
        awardEnqueued,
        awardAlreadyPresent: Boolean(existing),
        placements: nextResult.placements.map((placement) => {
          const participant = draw.participants.find((row) => row.entryId === placement.entryId)
          return {
            placement: placement.placement,
            name: participant?.snapshotDisplayName ?? placement.entryId,
          }
        }),
      })
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        fixedCount: fixed.length,
        skippedCount: skipped.length,
        fixed,
        skipped,
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
