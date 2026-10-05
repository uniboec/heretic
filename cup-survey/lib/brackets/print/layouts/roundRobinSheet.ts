import type { BracketExportCategory } from '../../export/types'
import { resolveBoutIdForBracketMatch } from '../../scheduleHint'
import type { PrintPage, RoundRobinPrintData } from '../types'
import { buildPageChrome } from '../formatCategoryMeta'
import { buildSlotContext, resolvePlacementSlot } from '../resolvePrintSlots'
import { A4_LANDSCAPE, A4_PORTRAIT } from '../printTheme'

function resolveRoundRobinCellBoutLabel(
  category: BracketExportCategory,
  matchNumber: number | undefined,
): string | null {
  if (!matchNumber) return null

  const boutId = resolveBoutIdForBracketMatch(category.categoryKey, `rr-${matchNumber}`)
  const displayNumber = category.scheduleDisplayByBoutId?.get(boutId)
  return displayNumber ?? String(matchNumber)
}

function formatPairScore(
  category: BracketExportCategory,
  matchNumber: number | undefined,
  entryId: string,
): string | null {
  if (!matchNumber) return null
  const outcome = category.boutOutcomes[`bout-${matchNumber}`]
  if (!outcome?.winnerEntryId) return null
  const isWinner = outcome.winnerEntryId === entryId
  return isWinner
    ? `${outcome.mainRedScore}:${outcome.mainBlueScore}`
    : `${outcome.mainBlueScore}:${outcome.mainRedScore}`
}

export function buildRoundRobinPage(category: BracketExportCategory): PrintPage {
  const ctx = buildSlotContext(category)
  const participants = [...category.participants].sort((a, b) => a.seedPosition - b.seedPosition)
  const pairs = category.structure.roundRobinPairs ?? []
  const pairMap = new Map<string, (typeof pairs)[number]>()

  for (const pair of pairs) {
    const key = pair.entryIdA < pair.entryIdB ? `${pair.entryIdA}:${pair.entryIdB}` : `${pair.entryIdB}:${pair.entryIdA}`
    pairMap.set(key, pair)
  }

  const matrix = participants.map((row) =>
    participants.map((col) => {
      if (row.entryId === col.entryId) {
        return {
          rowEntryId: row.entryId,
          colEntryId: col.entryId,
          boutNumber: null,
          boutLabel: null,
          score: null,
          finished: false,
        }
      }
      const key = row.entryId < col.entryId ? `${row.entryId}:${col.entryId}` : `${col.entryId}:${row.entryId}`
      const pair = pairMap.get(key)
      const score = pair ? formatPairScore(category, pair.matchNumber, row.entryId) : null
      const matchNumber = pair?.matchNumber
      return {
        rowEntryId: row.entryId,
        colEntryId: col.entryId,
        boutNumber: matchNumber ?? null,
        boutLabel: resolveRoundRobinCellBoutLabel(category, matchNumber),
        score,
        finished: Boolean(pair?.winnerEntryId),
      }
    }),
  )

  const standings = (category.structure.roundRobinStandings ?? []).map((row, index) => ({
    entryId: row.entryId,
    wins: row.wins,
    losses: row.losses,
    rank: index + 1,
  }))

  const roundRobin: RoundRobinPrintData = {
    participants: participants.map((p) => ({
      entryId: p.entryId,
      seedPosition: p.seedPosition,
      name: p.displayName,
      club: p.clubName,
    })),
    matrix,
    standings,
  }

  const orientation = category.participantCount > 5 ? 'landscape' : 'portrait'
  const view = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT

  return {
    layoutKind: 'roundRobin',
    orientation,
    viewBoxWidth: view.width,
    viewBoxHeight: view.height,
    chrome: buildPageChrome({ category, pageIndex: 0, pageCount: 1, roundRangeLabel: 'Круговая система' }),
    connectorPaths: [],
    matches: [],
    placements: [
      { placement: 1, slot: resolvePlacementSlot(ctx, 1) },
      { placement: 2, slot: resolvePlacementSlot(ctx, 2) },
      { placement: 3, slot: resolvePlacementSlot(ctx, 3) },
    ],
    roundRobin,
  }
}
