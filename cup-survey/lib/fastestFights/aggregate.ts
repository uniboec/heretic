import { formatVictoryMethodFull, type VictoryMethod } from '@/lib/config/fseRules'
import { isFastestFightEligible, MIN_FASTEST_FIGHT_ELAPSED_MS } from './eligibility'
import { formatFastestFightTime } from './format'
import type {
  FastestFightBoutMeta,
  FastestFightBoutResultInput,
  FastestFightParticipant,
  FastestFightRow,
} from './types'

const TOP_LIMIT = 10

type SortableFastestFight = {
  boutElapsedMs: number
  resultConfirmedAt: Date
  scheduleDisplayNumber: string
}

function compareFastestFightRows(left: SortableFastestFight, right: SortableFastestFight): number {
  if (left.boutElapsedMs !== right.boutElapsedMs) {
    return left.boutElapsedMs - right.boutElapsedMs
  }

  const confirmedCompare = left.resultConfirmedAt.getTime() - right.resultConfirmedAt.getTime()
  if (confirmedCompare !== 0) {
    return confirmedCompare
  }

  return left.scheduleDisplayNumber.localeCompare(right.scheduleDisplayNumber)
}

export function aggregateFastestFights(input: {
  results: FastestFightBoutResultInput[]
  participantsByEntryId: Map<string, FastestFightParticipant>
  boutMetaById: Map<string, FastestFightBoutMeta>
}): { rows: FastestFightRow[]; totalEligible: number } {
  const eligible = input.results.filter(
    (result) =>
      result.boutElapsedMs != null &&
      result.boutElapsedMs >= MIN_FASTEST_FIGHT_ELAPSED_MS &&
      isFastestFightEligible(result.victoryMethod) &&
      result.winnerEntryId != null,
  )

  const sorted = [...eligible].sort((left, right) =>
    compareFastestFightRows(
      {
        boutElapsedMs: left.boutElapsedMs!,
        resultConfirmedAt: left.resultConfirmedAt,
        scheduleDisplayNumber:
          input.boutMetaById.get(left.boutId)?.scheduleDisplayNumber ?? '',
      },
      {
        boutElapsedMs: right.boutElapsedMs!,
        resultConfirmedAt: right.resultConfirmedAt,
        scheduleDisplayNumber:
          input.boutMetaById.get(right.boutId)?.scheduleDisplayNumber ?? '',
      },
    ),
  )

  const rows: FastestFightRow[] = sorted.slice(0, TOP_LIMIT).map((result, index) => {
    const participant = input.participantsByEntryId.get(result.winnerEntryId!)
    const meta = input.boutMetaById.get(result.boutId)
    const boutElapsedMs = result.boutElapsedMs!

    return {
      rank: index + 1,
      boutId: result.boutId,
      scheduleDisplayNumber: meta?.scheduleDisplayNumber ?? '',
      displayName: participant?.displayName ?? result.winnerEntryId!,
      clubName: participant?.clubName ?? '',
      city: participant?.city ?? '',
      boutElapsedMs,
      timeLabel: formatFastestFightTime(boutElapsedMs),
      victoryMethod: result.victoryMethod,
      victoryMethodLabel: formatVictoryMethodFull(result.victoryMethod as VictoryMethod, {
        submissionSubtype: result.submissionSubtype,
      }),
      categoryTitle: meta?.categoryTitle ?? '',
      discipline: meta?.discipline ?? '',
      confirmedAt: result.resultConfirmedAt.toISOString(),
    }
  })

  return { rows, totalEligible: eligible.length }
}
