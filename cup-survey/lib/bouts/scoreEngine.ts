import {
  awardedPointsForSanction,
  countsTowardPeriodPenaltyCount,
  type DecisionReason,
  type PenaltyLadder,
  type PenaltySanction,
  type VictoryMethod,
} from '../config/fseRules'
import { oppositeCorner } from './assertBoutParticipantCorner'
import type {
  BoutDecision,
  BoutEventRecord,
  BoutLiveHints,
  BoutParticipantContext,
  BoutPeriod,
  Corner,
  PenaltyEventPayload,
  ScoreState,
} from './mat-control/types'

type TechnicalScoreValue = 1 | 2 | 3 | 4

type TechnicalEpisode = {
  episodeId: string | null
  scores: Array<{ entryId: string; corner: Corner; points: number; sequence: number }>
  corners: Set<Corner>
  maxSequence: number
}

function emptyTechnicalCounts(): Record<TechnicalScoreValue, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0 }
}

function createInitialScoreState(): ScoreState {
  return {
    officialScore: { red: 0, blue: 0 },
    technicalScore: { red: 0, blue: 0 },
    periodPenaltyCount: { red: 0, blue: 0 },
    generalDisciplinaryLadder: { red: null, blue: null },
    outOfBoundsLadder: { red: null, blue: null },
    passivityLadder: { red: null, blue: null },
    technicalCounts: {
      red: emptyTechnicalCounts(),
      blue: emptyTechnicalCounts(),
    },
  }
}

function applyPenaltyScore(state: ScoreState, corner: Corner, awardedPoints: 0 | 1 | 2 | 3): void {
  const opponentCorner = oppositeCorner(corner)
  state.officialScore[opponentCorner] += awardedPoints
}

function applyTechnicalScore(state: ScoreState, corner: Corner, points: number): void {
  state.officialScore[corner] += points
  state.technicalScore[corner] += points
  if (points >= 1 && points <= 4) {
    state.technicalCounts[corner][points as TechnicalScoreValue] += 1
  }
}

function updateLadderStep(
  ladderState: { red: PenaltySanction | null; blue: PenaltySanction | null },
  corner: Corner,
  sanction: PenaltySanction,
): void {
  ladderState[corner] = sanction
}

export function reduceScoreEvents(
  events: BoutEventRecord[],
  period: BoutPeriod,
  attemptNumber: number,
): ScoreState {
  const state = createInitialScoreState()

  for (const event of events) {
    if (event.undoneAt || event.attemptNumber !== attemptNumber || event.period !== period) {
      continue
    }

    if (event.eventType === 'TECHNICAL_SCORE' && event.cornerAtEvent && event.points != null) {
      applyTechnicalScore(state, event.cornerAtEvent, event.points)
      continue
    }

    if (event.eventType === 'PENALTY' && event.cornerAtEvent) {
      const payload = event.payload as PenaltyEventPayload | null
      if (!payload) continue

      applyPenaltyScore(state, event.cornerAtEvent, payload.awardedPoints)

      if (countsTowardPeriodPenaltyCount(payload.sanction)) {
        state.periodPenaltyCount[event.cornerAtEvent] += 1
      }

      if (payload.ladder === 'GENERAL') {
        updateLadderStep(state.generalDisciplinaryLadder, event.cornerAtEvent, payload.sanction)
      } else if (payload.ladder === 'OUT_OF_BOUNDS') {
        updateLadderStep(state.outOfBoundsLadder, event.cornerAtEvent, payload.sanction)
      } else if (payload.ladder === 'PASSIVITY') {
        updateLadderStep(state.passivityLadder, event.cornerAtEvent, payload.sanction)
      }
    }
  }

  return state
}

function buildTechnicalEpisodes(events: BoutEventRecord[], period: BoutPeriod): TechnicalEpisode[] {
  const episodeMap = new Map<string, TechnicalEpisode>()

  for (const event of events) {
    if (
      event.undoneAt ||
      event.eventType !== 'TECHNICAL_SCORE' ||
      event.period !== period ||
      !event.cornerAtEvent ||
      event.points == null ||
      event.points <= 0
    ) {
      continue
    }

    const key = event.episodeId ?? `solo:${event.id}`
    const episode =
      episodeMap.get(key) ??
      ({
        episodeId: event.episodeId,
        scores: [],
        corners: new Set<Corner>(),
        maxSequence: event.sequence,
      } satisfies TechnicalEpisode)

    episode.scores.push({
      entryId: event.entryId ?? '',
      corner: event.cornerAtEvent,
      points: event.points,
      sequence: event.sequence,
    })
    episode.corners.add(event.cornerAtEvent)
    episode.maxSequence = Math.max(episode.maxSequence, event.sequence)
    episodeMap.set(key, episode)
  }

  return [...episodeMap.values()].sort((a, b) => a.maxSequence - b.maxSequence)
}

function resolveLastTechnicalEpisode(
  events: BoutEventRecord[],
  period: BoutPeriod,
): { winnerCorner: Corner | null; simultaneous: boolean } {
  const episodes = buildTechnicalEpisodes(events, period)
  if (episodes.length === 0) {
    return { winnerCorner: null, simultaneous: false }
  }

  const lastEpisode = episodes[episodes.length - 1]!
  if (lastEpisode.corners.has('red') && lastEpisode.corners.has('blue')) {
    return { winnerCorner: null, simultaneous: true }
  }

  const lastScore = lastEpisode.scores[lastEpisode.scores.length - 1]
  return { winnerCorner: lastScore?.corner ?? null, simultaneous: false }
}

function compareHigherTechnicalScore(state: ScoreState): Corner | null {
  for (const value of [4, 3, 2, 1] as const) {
    const redCount = state.technicalCounts.red[value]
    const blueCount = state.technicalCounts.blue[value]
    if (redCount > blueCount) return 'red'
    if (blueCount > redCount) return 'blue'
  }
  return null
}

function entryIdForCorner(
  corner: Corner,
  participants: BoutParticipantContext,
): string | null {
  if (corner === 'red') {
    return participants.cornersSwapped ? participants.blueEntryId : participants.redEntryId
  }
  return participants.cornersSwapped ? participants.redEntryId : participants.blueEntryId
}

function winnerFromCorner(
  corner: Corner,
  participants: BoutParticipantContext,
): { winnerEntryId: string | null; loserEntryId: string | null } {
  const winnerEntryId = entryIdForCorner(corner, participants)
  const loserCorner = oppositeCorner(corner)
  const loserEntryId = entryIdForCorner(loserCorner, participants)
  return { winnerEntryId, loserEntryId }
}

function buildDecision(
  reason: DecisionReason,
  period: BoutPeriod,
  participants: BoutParticipantContext,
  state: ScoreState,
  winnerCorner: Corner | null,
  details?: BoutDecision['details'],
): BoutDecision {
  if (winnerCorner) {
    const { winnerEntryId, loserEntryId } = winnerFromCorner(winnerCorner, participants)
    return {
      winnerEntryId,
      loserEntryId,
      reason,
      decidedInPeriod: period,
      details: {
        scoreRed: state.officialScore.red,
        scoreBlue: state.officialScore.blue,
        redPenalties: state.periodPenaltyCount.red,
        bluePenalties: state.periodPenaltyCount.blue,
        ...details,
      },
    }
  }

  return {
    winnerEntryId: null,
    loserEntryId: null,
    reason,
    decidedInPeriod: period,
    details: {
      scoreRed: state.officialScore.red,
      scoreBlue: state.officialScore.blue,
      redPenalties: state.periodPenaltyCount.red,
      bluePenalties: state.periodPenaltyCount.blue,
      ...details,
    },
  }
}

function resolveActivityDecision(events: BoutEventRecord[]): BoutDecision | null {
  const activityEvents = events.filter(
    (event) => !event.undoneAt && event.eventType === 'EXTRA_ACTIVITY_DECISION',
  )
  const latest = activityEvents[activityEvents.length - 1]
  if (!latest?.payload) return null

  const payload = latest.payload as {
    winnerEntryId?: string
    loserEntryId?: string
    winnerCorner?: Corner
  }

  if (!payload.winnerEntryId) return null

  return {
    winnerEntryId: payload.winnerEntryId,
    loserEntryId: payload.loserEntryId ?? null,
    reason: 'EXTRA_ACTIVITY',
    decidedInPeriod: 'extra',
    details: payload.winnerCorner ? { winnerCorner: payload.winnerCorner } : undefined,
  }
}

function latestStoppagePayload(events: BoutEventRecord[]) {
  const latestStoppage = [...events]
    .reverse()
    .find((event) => !event.undoneAt && event.eventType === 'BOUT_STOPPAGE')
  return latestStoppage?.payload as
    | {
        proposedVictoryMethod?: VictoryMethod
        winnerEntryId?: string | null
        loserEntryId?: string | null
        proposedDecisionReason?: DecisionReason
        submissionSubtype?: 'ARM' | 'LEG' | 'OTHER'
      }
    | undefined
}

/** Decision used for confirmation UI and CONFIRM — prefers stoppage winner over 0:0 score tie. */
export function resolveEffectiveBoutDecision(input: {
  events: BoutEventRecord[]
  period: BoutPeriod
  attemptNumber: number
  participants: BoutParticipantContext
}): BoutDecision {
  const scoreDecision = resolveBoutDecision(input)
  const payload = latestStoppagePayload(
    input.events.filter((event) => event.attemptNumber === input.attemptNumber),
  )
  const useStoppageDecision =
    payload?.winnerEntryId &&
    (payload.proposedVictoryMethod !== 'POINTS' || scoreDecision.winnerEntryId == null)

  if (!useStoppageDecision) return scoreDecision

  return {
    winnerEntryId: payload.winnerEntryId!,
    loserEntryId: payload.loserEntryId ?? null,
    reason: payload.proposedDecisionReason ?? payload.proposedVictoryMethod ?? 'POINTS',
    decidedInPeriod: input.period,
    details: payload.submissionSubtype
      ? { submissionSubtype: payload.submissionSubtype }
      : undefined,
  }
}

export function resolveBoutDecision(input: {
  events: BoutEventRecord[]
  period: BoutPeriod
  attemptNumber: number
  participants: BoutParticipantContext
}): BoutDecision {
  const { events, period, attemptNumber, participants } = input
  const filtered = events.filter((event) => event.attemptNumber === attemptNumber)
  const state = reduceScoreEvents(filtered, period, attemptNumber)

  if (period === 'extra') {
    const activityDecision = resolveActivityDecision(filtered)
    if (activityDecision) {
      return activityDecision
    }
  }

  if (state.officialScore.red !== state.officialScore.blue) {
    const winnerCorner: Corner = state.officialScore.red > state.officialScore.blue ? 'red' : 'blue'
    return buildDecision('TOTAL_SCORE', period, participants, state, winnerCorner)
  }

  const higherTechnicalCorner = compareHigherTechnicalScore(state)
  if (higherTechnicalCorner) {
    const comparedScoreValue = ([4, 3, 2, 1] as const).find(
      (value) =>
        state.technicalCounts.red[value] !== state.technicalCounts.blue[value],
    )
    return buildDecision('HIGHER_TECHNICAL_SCORE', period, participants, state, higherTechnicalCorner, {
      comparedScoreValue,
      redCount: comparedScoreValue ? state.technicalCounts.red[comparedScoreValue] : undefined,
      blueCount: comparedScoreValue ? state.technicalCounts.blue[comparedScoreValue] : undefined,
    })
  }

  if (state.periodPenaltyCount.red !== state.periodPenaltyCount.blue) {
    const winnerCorner: Corner =
      state.periodPenaltyCount.red < state.periodPenaltyCount.blue ? 'red' : 'blue'
    return buildDecision('FEWER_PENALTIES', period, participants, state, winnerCorner)
  }

  const lastTechnical = resolveLastTechnicalEpisode(filtered, period)
  if (lastTechnical.simultaneous) {
    return buildDecision(
      period === 'main' ? 'EXTRA_ROUND_REQUIRED' : 'EXTRA_ACTIVITY',
      period,
      participants,
      state,
      null,
    )
  }

  if (lastTechnical.winnerCorner) {
    return buildDecision(
      'LAST_TECHNICAL_SCORE',
      period,
      participants,
      state,
      lastTechnical.winnerCorner,
      { lastTechnicalCorner: lastTechnical.winnerCorner },
    )
  }

  return buildDecision(
    period === 'main' ? 'EXTRA_ROUND_REQUIRED' : 'EXTRA_ACTIVITY',
    period,
    participants,
    state,
    null,
  )
}

export function computeBoutLiveHints(input: {
  events: BoutEventRecord[]
  period: BoutPeriod
  attemptNumber: number
}): BoutLiveHints {
  const state = reduceScoreEvents(input.events, input.period, input.attemptNumber)
  const scoreDifference = Math.abs(state.officialScore.red - state.officialScore.blue)
  const leadingCorner =
    state.officialScore.red === state.officialScore.blue
      ? undefined
      : state.officialScore.red > state.officialScore.blue
        ? ('red' as const)
        : ('blue' as const)

  return {
    clearAdvantageEligible: scoreDifference >= 10,
    leadingCorner,
    scoreDifference,
  }
}

export function buildPenaltyEventPayload(input: {
  ladder: PenaltyLadder
  sanction: PenaltySanction
}): PenaltyEventPayload {
  return {
    ladder: input.ladder,
    sanction: input.sanction,
    awardedPoints: awardedPointsForSanction(input.sanction),
  }
}

export { createInitialScoreState }
