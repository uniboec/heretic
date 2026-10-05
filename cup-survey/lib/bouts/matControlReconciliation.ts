import { prisma } from '../prisma'
import { TOURNAMENT_SCOPE_ID } from '../config/tournament'
import { loadBoutEvents } from './matControlContext'
import { mapEventRow } from './matControlMappers'
import { wasFightClockStarted } from '../fastestFights/fightClockStarted'
import { isFastestFightRankingEligible } from '../fastestFights/eligibility'
import type { BracketStructure } from '../brackets/core/types'
import { loadFullScheduleSnapshot } from './scheduleService'

export type RatingBracketMismatch = {
  boutId: string
  categoryKey: string
  systemId: string
  winnerEntryId: string | null
  bracketWinnerEntryId: string | null
  victoryMethod: string | null
  fightOfficiallyStarted: boolean | null
}

function globalBoutId(categoryKey: string, localId: string): string {
  return `${categoryKey}::${localId}`
}

function collectBracketWinners(structure: BracketStructure, categoryKey: string): Map<string, string | null> {
  const winners = new Map<string, string | null>()
  for (const match of structure.rounds) {
    winners.set(globalBoutId(categoryKey, match.id), match.winnerEntryId ?? null)
  }
  for (const bronze of structure.bronzeSlots ?? []) {
    winners.set(globalBoutId(categoryKey, bronze.id), bronze.winnerEntryId ?? null)
  }
  for (const pair of structure.roundRobinPairs ?? []) {
    const id = `rr-${pair.entryIdA}-${pair.entryIdB}-${pair.round}`
    winners.set(globalBoutId(categoryKey, id), pair.winnerEntryId ?? null)
  }
  return winners
}

export async function findRatingBracketMismatches(input?: {
  categoryKey?: string
  limit?: number
}): Promise<RatingBracketMismatch[]> {
  const limit = input?.limit ?? 200
  const snapshot = await loadFullScheduleSnapshot(prisma, { adminPreview: true })
  const boutMeta = new Map(
    snapshot.grouped.mats
      .flatMap((mat) => mat.bouts)
      .map((bout) => [bout.id, { categoryKey: bout.categoryKey, schedulePhase: bout.schedulePhase }]),
  )

  const results = await prisma.boutResult.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      invalidatedAt: null,
    },
    orderBy: { resultConfirmedAt: 'desc' },
    take: limit,
    select: {
      boutId: true,
      winnerEntryId: true,
      victoryMethod: true,
      fightOfficiallyStarted: true,
    },
  })

  const draws = await prisma.bracketCategoryDraw.findMany({
    where: input?.categoryKey ? { categoryKey: input.categoryKey } : undefined,
    select: {
      categoryKey: true,
      publishedStructureJson: true,
      systemOverride: true,
      autoSystemId: true,
    },
  })

  const bracketWinnersByBout = new Map<string, string | null>()
  const systemIdByCategory = new Map<string, string>()
  for (const draw of draws) {
    systemIdByCategory.set(draw.categoryKey, draw.systemOverride ?? draw.autoSystemId)
    const structure = draw.publishedStructureJson as BracketStructure | null
    if (!structure) continue
    for (const [boutId, winner] of collectBracketWinners(structure, draw.categoryKey)) {
      bracketWinnersByBout.set(boutId, winner)
    }
  }

  const mismatches: RatingBracketMismatch[] = []
  for (const row of results) {
    const meta = boutMeta.get(row.boutId)
    if (!meta) continue
    if (input?.categoryKey && meta.categoryKey !== input.categoryKey) continue

    const bracketWinner = bracketWinnersByBout.get(row.boutId)
    if (bracketWinner === undefined) continue
    if (bracketWinner !== row.winnerEntryId) {
      mismatches.push({
        boutId: row.boutId,
        categoryKey: meta.categoryKey,
        systemId: systemIdByCategory.get(meta.categoryKey) ?? 'olympic',
        winnerEntryId: row.winnerEntryId,
        bracketWinnerEntryId: bracketWinner,
        victoryMethod: row.victoryMethod,
        fightOfficiallyStarted: row.fightOfficiallyStarted,
      })
    }
  }
  return mismatches
}

export async function backfillFightOfficiallyStarted(input?: { boutId?: string; dryRun?: boolean }) {
  const results = await prisma.boutResult.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      invalidatedAt: null,
      ...(input?.boutId ? { boutId: input.boutId } : {}),
    },
    select: { id: true, boutId: true, fightOfficiallyStarted: true },
    take: input?.boutId ? 1 : 5000,
  })

  const updates: Array<{ boutId: string; from: boolean | null; to: boolean }> = []
  for (const row of results) {
    const events = (await loadBoutEvents(prisma, row.boutId)).map(mapEventRow)
    const shouldBe = wasFightClockStarted(events)
    if (row.fightOfficiallyStarted === shouldBe) continue
    updates.push({ boutId: row.boutId, from: row.fightOfficiallyStarted, to: shouldBe })
    if (!input?.dryRun) {
      await prisma.boutResult.update({
        where: { id: row.id },
        data: { fightOfficiallyStarted: shouldBe },
      })
    }
  }

  return { dryRun: Boolean(input?.dryRun), updated: updates.length, updates }
}

export type FastestFightEligibilityGap = {
  boutId: string
  victoryMethod: string
  boutElapsedMs: number | null
  fightOfficiallyStarted: boolean
  reason: string
}

export async function findFastestFightEligibilityGaps(input?: {
  limit?: number
}): Promise<FastestFightEligibilityGap[]> {
  const limit = input?.limit ?? 200
  const results = await prisma.boutResult.findMany({
    where: {
      tournamentScopeId: TOURNAMENT_SCOPE_ID,
      invalidatedAt: null,
      victoryMethod: { in: ['SUBMISSION', 'CHOKE', 'CLEAR_ADVANTAGE'] },
    },
    orderBy: { resultConfirmedAt: 'desc' },
    take: limit,
    select: {
      boutId: true,
      victoryMethod: true,
      boutElapsedMs: true,
      fightOfficiallyStarted: true,
    },
  })

  const gaps: FastestFightEligibilityGap[] = []
  for (const row of results) {
    const eligible = isFastestFightRankingEligible({
      victoryMethod: row.victoryMethod,
      boutElapsedMs: row.boutElapsedMs ?? 0,
      fightOfficiallyStarted: row.fightOfficiallyStarted,
    })
    if (eligible) continue

    let reason = 'Не проходит фильтр fastest fights'
    if (!row.fightOfficiallyStarted) {
      reason = 'fightOfficiallyStarted=false'
    } else if ((row.boutElapsedMs ?? 0) < 1000) {
      reason = 'boutElapsedMs < 1s'
    }

    gaps.push({
      boutId: row.boutId,
      victoryMethod: row.victoryMethod,
      boutElapsedMs: row.boutElapsedMs,
      fightOfficiallyStarted: row.fightOfficiallyStarted,
      reason,
    })
  }
  return gaps
}
