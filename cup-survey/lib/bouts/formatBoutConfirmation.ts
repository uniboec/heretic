import {
  formatVictoryMethod,
  type SubmissionSubtype,
  type VictoryMethod,
} from '../config/fseRules'
import { formatFastestFightTime } from '../fastestFights/format'
import { isFastestFightRankingEligible } from '../fastestFights/eligibility'
import { wasFightClockStarted } from '../fastestFights/fightClockStarted'
import type { BoutDecision, BoutEventRecord } from './mat-control/types'
import { resolveEffectiveBoutStoppage } from './resolveEffectiveBoutStoppage'

export type BoutConfirmationSummary = {
  winnerLabel: string
  loserLabel: string | null
  victoryMethodLabel: string
  decisionReason: string
  mainScore: string
  extraScore: string | null
  countsForFastestFights: boolean
  fastestFightTimeLabel: string | null
}

function entryDisplayName(
  entryId: string | null,
  redEntryId: string | null,
  blueEntryId: string | null,
  redName: string,
  blueName: string,
): string {
  if (!entryId) return '—'
  if (entryId === redEntryId) return redName
  if (entryId === blueEntryId) return blueName
  return entryId
}

function latestStoppage(events: BoutEventRecord[]): BoutEventRecord | null {
  const stoppages = events.filter((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
  return stoppages[stoppages.length - 1] ?? null
}

export function buildBoutConfirmationSummary(input: {
  events: BoutEventRecord[]
  decision: BoutDecision
  redEntryId: string | null
  blueEntryId: string | null
  redName: string
  blueName: string
  mainRedScore: number
  mainBlueScore: number
  extraRedScore?: number | null
  extraBlueScore?: number | null
}): BoutConfirmationSummary {
  const stoppage = latestStoppage(input.events)
  const payload = (stoppage?.payload ?? {}) as {
    proposedVictoryMethod?: VictoryMethod
    submissionSubtype?: SubmissionSubtype
  }

  const victoryMethod = payload.proposedVictoryMethod ?? 'POINTS'
  const submissionSubtype = payload.submissionSubtype ?? input.decision.details?.submissionSubtype
  const victoryMethodLabel =
    input.decision.reason === 'EXTRA_ACTIVITY'
      ? 'Активнее'
      : formatVictoryMethod(victoryMethod, {
          submissionSubtype,
          operatorFacing: true,
        })

  const winnerLabel = entryDisplayName(
    input.decision.winnerEntryId,
    input.redEntryId,
    input.blueEntryId,
    input.redName,
    input.blueName,
  )
  const loserLabel = input.decision.loserEntryId
    ? entryDisplayName(
        input.decision.loserEntryId,
        input.redEntryId,
        input.blueEntryId,
        input.redName,
        input.blueName,
      )
    : null

  const extraScore =
    input.extraRedScore != null && input.extraBlueScore != null
      ? `${input.extraRedScore}:${input.extraBlueScore}`
      : null

  const effectiveStoppage = resolveEffectiveBoutStoppage(input.events)
  const countsForFastestFights =
    effectiveStoppage !== null &&
    isFastestFightRankingEligible({
      victoryMethod,
      boutElapsedMs: effectiveStoppage.boutElapsedMs,
      fightOfficiallyStarted: wasFightClockStarted(input.events),
    })

  return {
    winnerLabel,
    loserLabel,
    victoryMethodLabel,
    decisionReason: input.decision.reason,
    mainScore: `${input.mainRedScore}:${input.mainBlueScore}`,
    extraScore,
    countsForFastestFights,
    fastestFightTimeLabel: countsForFastestFights
      ? formatFastestFightTime(effectiveStoppage!.boutElapsedMs)
      : null,
  }
}
