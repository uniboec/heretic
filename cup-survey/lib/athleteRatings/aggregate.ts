import { formatVictoryMethodFull, type VictoryMethod } from '@/lib/config/fseRules'
import { getDisciplineShortLabel } from '@/lib/config/tournament'
import type { CategoryPlacement } from '@/lib/brackets/core/types'
import {
  getAgeBracketLabel,
  getAgeCoeffPercent,
  resolveAgeBracketKey,
} from './ageCoefficient'
import {
  ATHLETE_RATING_DISCIPLINES,
  type AthleteRatingDiscipline,
  type AthleteRatingView,
} from './constants'
import { resolveVictoryOutcome } from './eligibility'
import {
  formatPlacementSummaryForView,
  formatResultsSummaryForView,
} from './formatResultsSummary'
import { getAthleteAgeOnTournamentDate } from '@/lib/registration/categoryRules'
import {
  applyAgeCoefficientHundredths,
  formatRatingHundredths,
  placeWithWinsHundredths,
  placeWithoutWinsHundredths,
  pointsToHundredths,
} from './ratingMath'
import { assignRanks, compareTieBreakMetrics } from './tieBreak'
import type {
  AthleteRatingBreakdownLine,
  AthleteRatingCategorySource,
  AthleteRatingComputedAthlete,
  AthleteRatingDisciplineBreakdown,
  AthleteRatingDisciplineResult,
  AthleteRatingEntryInfo,
  AthleteRatingRankedRow,
  AthleteRatingSettings,
  AthleteRatingTieBreakMetrics,
} from './types'

type EntryDisciplineContribution = {
  entryId: string
  entryInfo: AthleteRatingEntryInfo
  placement: number | null
  disciplineResult: AthleteRatingDisciplineResult
}

function emptyTieBreak(): AthleteRatingTieBreakMetrics {
  return {
    countableWins: 0,
    submissionChokeWins: 0,
    firstPlaces: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    bestSingleDisciplineHundredths: 0,
  }
}

function getPlacePoints(placement: number, settings: AthleteRatingSettings): number {
  if (placement === 1) return settings.firstPlacePoints
  if (placement === 2) return settings.secondPlacePoints
  if (placement === 3) return settings.thirdPlacePoints
  return 0
}

function formatVictoryWinLabel(victoryMethod: string): string {
  const methodLabel = formatVictoryMethodFull(victoryMethod as VictoryMethod)
  return `Победа ${methodLabel}`
}

function buildDisciplineResult(input: {
  discipline: AthleteRatingDiscipline
  entryInfo: AthleteRatingEntryInfo
  placement: number | null
  wins: Array<{ victoryMethod: string; fightOfficiallyStarted: boolean }>
  settings: AthleteRatingSettings
}): AthleteRatingDisciplineResult {
  const ageBracketKey = resolveAgeBracketKey({
    ageDivisionId: input.entryInfo.ageDivisionId,
    birthDate: input.entryInfo.birthDate,
  })
  const ageCoeffPercent = getAgeCoeffPercent(ageBracketKey, input.settings.ageCoefficients)

  const lines: AthleteRatingBreakdownLine[] = []
  let countableWins = 0
  let pointsWins = 0
  let submissionChokeWins = 0
  let injuryWins = 0
  let dqWins = 0
  let forfeitWins = 0

  const placePoints = input.placement ? getPlacePoints(input.placement, input.settings) : 0
  let placeHundredths = 0

  for (const win of input.wins) {
    const outcome = resolveVictoryOutcome(
      win.victoryMethod,
      win.fightOfficiallyStarted,
      input.settings,
    )
    if (outcome.countableWin) {
      countableWins += 1
      lines.push({
        label: formatVictoryWinLabel(win.victoryMethod),
        pointsHundredths: pointsToHundredths(outcome.points),
      })
    }
    if (
      outcome.countableWin &&
      (win.victoryMethod === 'POINTS' || win.victoryMethod === 'CLEAR_ADVANTAGE')
    ) {
      pointsWins += 1
    }
    if (outcome.submissionChoke) submissionChokeWins += 1
    if (outcome.injury) injuryWins += 1
    if (outcome.dq) dqWins += 1
    if (outcome.forfeit) forfeitWins += 1
  }

  if (input.placement && placePoints > 0) {
    if (countableWins === 0) {
      placeHundredths = placeWithoutWinsHundredths(
        placePoints,
        input.settings.placeWithoutWinPercent,
      )
      lines.unshift({
        label: `${input.placement} место (без зачётных побед, ${input.settings.placeWithoutWinPercent}%)`,
        pointsHundredths: placeHundredths,
      })
    } else {
      placeHundredths = placeWithWinsHundredths(placePoints)
      lines.unshift({
        label: `${input.placement} место`,
        pointsHundredths: placeHundredths,
      })
    }
  }

  const winHundredths = lines
    .filter((line) => line.label.startsWith('Победа'))
    .reduce((sum, line) => sum + line.pointsHundredths, 0)
  const rawHundredths = placeHundredths + winHundredths
  const ratingHundredths = applyAgeCoefficientHundredths(rawHundredths, ageCoeffPercent)

  const tieBreak: AthleteRatingTieBreakMetrics = {
    countableWins,
    submissionChokeWins,
    firstPlaces: input.placement === 1 ? 1 : 0,
    secondPlaces: input.placement === 2 ? 1 : 0,
    thirdPlaces: input.placement === 3 ? 1 : 0,
    bestSingleDisciplineHundredths: ratingHundredths,
  }

  const breakdown: AthleteRatingDisciplineBreakdown = {
    discipline: input.discipline,
    disciplineLabel: getDisciplineShortLabel(input.discipline),
    lines,
    rawHundredths,
    ageBracketKey,
    ageBracketLabel: getAgeBracketLabel(ageBracketKey),
    ageCoeffPercent,
    ratingHundredths,
  }

  return {
    discipline: input.discipline,
    ratingHundredths,
    placements: input.placement != null ? [input.placement] : [],
    countableWins,
    pointsWins,
    submissionChokeWins,
    injuryWins,
    dqWins,
    forfeitWins,
    tieBreak,
    breakdown,
  }
}

function findPlacement(
  placements: CategoryPlacement[],
  entryId: string,
): number | null {
  const placement = placements.find((row) => row.entryId === entryId)
  return placement?.placement ?? null
}

function collectWinsForEntry(
  categories: AthleteRatingCategorySource[],
  entryId: string,
): Array<{ victoryMethod: string; fightOfficiallyStarted: boolean }> {
  const wins: Array<{ victoryMethod: string; fightOfficiallyStarted: boolean }> = []
  for (const category of categories) {
    for (const bout of category.boutResults) {
      if (bout.winnerEntryId === entryId) {
        wins.push({
          victoryMethod: bout.victoryMethod,
          fightOfficiallyStarted: bout.fightOfficiallyStarted,
        })
      }
    }
  }
  return wins
}

function mergeDisciplineResults(
  discipline: AthleteRatingDiscipline,
  entries: EntryDisciplineContribution[],
): AthleteRatingDisciplineResult {
  const first = entries[0]?.disciplineResult
  if (!first) {
    throw new Error(`No discipline results to merge for ${discipline}`)
  }
  if (entries.length === 1) {
    return first
  }

  const merged: AthleteRatingDisciplineResult = {
    discipline,
    ratingHundredths: 0,
    placements: [],
    countableWins: 0,
    pointsWins: 0,
    submissionChokeWins: 0,
    injuryWins: 0,
    dqWins: 0,
    forfeitWins: 0,
    tieBreak: emptyTieBreak(),
    breakdown: {
      discipline,
      disciplineLabel: getDisciplineShortLabel(discipline),
      lines: [],
      rawHundredths: 0,
      ageBracketKey: first.breakdown.ageBracketKey,
      ageBracketLabel: first.breakdown.ageBracketLabel,
      ageCoeffPercent: first.breakdown.ageCoeffPercent,
      ratingHundredths: 0,
    },
  }

  for (const entry of entries) {
    const result = entry.disciplineResult
    merged.ratingHundredths += result.ratingHundredths
    merged.placements.push(...result.placements)
    merged.countableWins += result.countableWins
    merged.pointsWins += result.pointsWins
    merged.submissionChokeWins += result.submissionChokeWins
    merged.injuryWins += result.injuryWins
    merged.dqWins += result.dqWins
    merged.forfeitWins += result.forfeitWins

    merged.tieBreak.countableWins += result.tieBreak.countableWins
    merged.tieBreak.submissionChokeWins += result.tieBreak.submissionChokeWins
    merged.tieBreak.firstPlaces += result.tieBreak.firstPlaces
    merged.tieBreak.secondPlaces += result.tieBreak.secondPlaces
    merged.tieBreak.thirdPlaces += result.tieBreak.thirdPlaces
    merged.tieBreak.bestSingleDisciplineHundredths = Math.max(
      merged.tieBreak.bestSingleDisciplineHundredths,
      result.tieBreak.bestSingleDisciplineHundredths,
    )

    merged.breakdown.lines.push(...result.breakdown.lines)
    merged.breakdown.rawHundredths += result.breakdown.rawHundredths
    merged.breakdown.ratingHundredths += result.breakdown.ratingHundredths
  }

  merged.placements.sort((left, right) => left - right)
  return merged
}

function mergeOverallTieBreak(
  tacticControl: AthleteRatingDisciplineResult | null,
  closeControl: AthleteRatingDisciplineResult | null,
): AthleteRatingTieBreakMetrics {
  const tc = tacticControl?.tieBreak ?? emptyTieBreak()
  const cc = closeControl?.tieBreak ?? emptyTieBreak()
  const tcRating = tacticControl?.ratingHundredths ?? 0
  const ccRating = closeControl?.ratingHundredths ?? 0

  return {
    countableWins: tc.countableWins + cc.countableWins,
    submissionChokeWins: tc.submissionChokeWins + cc.submissionChokeWins,
    firstPlaces: tc.firstPlaces + cc.firstPlaces,
    secondPlaces: tc.secondPlaces + cc.secondPlaces,
    thirdPlaces: tc.thirdPlaces + cc.thirdPlaces,
    bestSingleDisciplineHundredths: Math.max(tcRating, ccRating),
  }
}

export function aggregateAthleteRatings(input: {
  categories: AthleteRatingCategorySource[]
  entryInfoByEntryId: Map<string, AthleteRatingEntryInfo>
  settings: AthleteRatingSettings
}): AthleteRatingComputedAthlete[] {
  const contributionsByAthlete = new Map<
    string,
    Map<AthleteRatingDiscipline, EntryDisciplineContribution[]>
  >()

  for (const category of input.categories) {
    const discipline = category.discipline as AthleteRatingDiscipline
    if (!ATHLETE_RATING_DISCIPLINES.includes(discipline)) {
      continue
    }

    const placements = category.result?.placements ?? []

    for (const participant of category.participants) {
      const entryInfo = input.entryInfoByEntryId.get(participant.entryId)
      if (!entryInfo) continue

      const placement = findPlacement(placements, participant.entryId)
      const wins = collectWinsForEntry([category], participant.entryId)
      const disciplineResult = buildDisciplineResult({
        discipline,
        entryInfo,
        placement,
        wins,
        settings: input.settings,
      })

      const athleteMap =
        contributionsByAthlete.get(entryInfo.athleteId) ??
        new Map<AthleteRatingDiscipline, EntryDisciplineContribution[]>()
      const list = athleteMap.get(discipline) ?? []
      list.push({
        entryId: participant.entryId,
        entryInfo,
        placement,
        disciplineResult,
      })
      athleteMap.set(discipline, list)
      contributionsByAthlete.set(entryInfo.athleteId, athleteMap)
    }
  }

  const athletes: AthleteRatingComputedAthlete[] = []

  for (const [athleteId, disciplineMap] of contributionsByAthlete) {
    let displayName = ''
    let clubName = ''
    let city = ''
    let birthDate = '2000-01-01'
    let ageBracketKey = resolveAgeBracketKey({ ageDivisionId: null, birthDate })
    let tacticControl: AthleteRatingDisciplineResult | null = null
    let closeControl: AthleteRatingDisciplineResult | null = null

    for (const discipline of ATHLETE_RATING_DISCIPLINES) {
      const entries = disciplineMap.get(discipline) ?? []
      if (entries.length === 0) continue

      const primary = entries[0]
      const merged = mergeDisciplineResults(discipline, entries)

      displayName = primary.entryInfo.displayName
      clubName = primary.entryInfo.clubName
      city = primary.entryInfo.city
      birthDate = primary.entryInfo.birthDate
      ageBracketKey = resolveAgeBracketKey({
        ageDivisionId: primary.entryInfo.ageDivisionId,
        birthDate,
      })

      if (discipline === 'tactic_control') {
        tacticControl = merged
      } else {
        closeControl = merged
      }
    }

    const overallRatingHundredths =
      (tacticControl?.ratingHundredths ?? 0) + (closeControl?.ratingHundredths ?? 0)

    athletes.push({
      athleteId,
      displayName,
      clubName,
      city,
      ageYears: getAthleteAgeOnTournamentDate(birthDate) ?? 0,
      ageBracketKey,
      ageBracketLabel: getAgeBracketLabel(ageBracketKey),
      tacticControl,
      closeControl,
      overallRatingHundredths,
      overallTieBreak: mergeOverallTieBreak(tacticControl, closeControl),
      anomalies: [],
    })
  }

  return athletes
}

function getViewRatingHundredths(
  athlete: AthleteRatingComputedAthlete,
  view: AthleteRatingView,
): number {
  if (view === 'tactic_control') return athlete.tacticControl?.ratingHundredths ?? 0
  if (view === 'close_control') return athlete.closeControl?.ratingHundredths ?? 0
  return athlete.overallRatingHundredths
}

function getViewTieBreak(
  athlete: AthleteRatingComputedAthlete,
  view: AthleteRatingView,
): AthleteRatingTieBreakMetrics {
  if (view === 'tactic_control') {
    return athlete.tacticControl?.tieBreak ?? emptyTieBreak()
  }
  if (view === 'close_control') {
    return athlete.closeControl?.tieBreak ?? emptyTieBreak()
  }
  return athlete.overallTieBreak
}

function getViewWins(athlete: AthleteRatingComputedAthlete, view: AthleteRatingView): number {
  if (view === 'tactic_control') return athlete.tacticControl?.countableWins ?? 0
  if (view === 'close_control') return athlete.closeControl?.countableWins ?? 0
  return (
    (athlete.tacticControl?.countableWins ?? 0) + (athlete.closeControl?.countableWins ?? 0)
  )
}

function getViewCounters(
  athlete: AthleteRatingComputedAthlete,
  view: AthleteRatingView,
): Pick<
  AthleteRatingRankedRow,
  'pointsWins' | 'submissionChokeWins' | 'injuryWins' | 'dqWins' | 'forfeitWins'
> {
  const pick = (result: AthleteRatingDisciplineResult | null) => ({
    pointsWins: result?.pointsWins ?? 0,
    submissionChokeWins: result?.submissionChokeWins ?? 0,
    injuryWins: result?.injuryWins ?? 0,
    dqWins: result?.dqWins ?? 0,
    forfeitWins: result?.forfeitWins ?? 0,
  })

  if (view === 'tactic_control') return pick(athlete.tacticControl)
  if (view === 'close_control') return pick(athlete.closeControl)

  const tc = pick(athlete.tacticControl)
  const cc = pick(athlete.closeControl)
  return {
    pointsWins: tc.pointsWins + cc.pointsWins,
    submissionChokeWins: tc.submissionChokeWins + cc.submissionChokeWins,
    injuryWins: tc.injuryWins + cc.injuryWins,
    dqWins: tc.dqWins + cc.dqWins,
    forfeitWins: tc.forfeitWins + cc.forfeitWins,
  }
}

export function rankAthletesForView(
  athletes: AthleteRatingComputedAthlete[],
  view: AthleteRatingView,
): AthleteRatingRankedRow[] {
  const sortable = athletes.map((athlete) => {
    const viewRatingHundredths = getViewRatingHundredths(athlete, view)
    const tieBreak = getViewTieBreak(athlete, view)
    const counters = getViewCounters(athlete, view)

    return {
      athleteId: athlete.athleteId,
      displayName: athlete.displayName,
      clubName: athlete.clubName,
      city: athlete.city,
      ageYears: athlete.ageYears,
      ageBracketLabel: athlete.ageBracketLabel,
      rank: null as number | null,
      unranked: viewRatingHundredths <= 0,
      viewRatingHundredths,
      wins: getViewWins(athlete, view),
      resultsSummary: formatResultsSummaryForView(
        view,
        athlete.tacticControl,
        athlete.closeControl,
      ),
      ratingHundredths: viewRatingHundredths,
      ratingFormatted: formatRatingHundredths(viewRatingHundredths),
      tacticControlRatingHundredths: athlete.tacticControl?.ratingHundredths ?? 0,
      closeControlRatingHundredths: athlete.closeControl?.ratingHundredths ?? 0,
      overallRatingHundredths: athlete.overallRatingHundredths,
      placementSummary: formatPlacementSummaryForView(
        view,
        athlete.tacticControl,
        athlete.closeControl,
      ),
      ...counters,
      anomalies: athlete.anomalies,
      tieBreak,
      breakdown: {
        tacticControl: athlete.tacticControl?.breakdown ?? null,
        closeControl: athlete.closeControl?.breakdown ?? null,
        overallRatingHundredths: athlete.overallRatingHundredths,
      },
    }
  })

  const sorted = [...sortable].sort((left, right) => {
    if (right.viewRatingHundredths !== left.viewRatingHundredths) {
      return right.viewRatingHundredths - left.viewRatingHundredths
    }
    const tieBreakCompare = compareTieBreakMetrics(left.tieBreak, right.tieBreak, view)
    if (tieBreakCompare !== 0) return tieBreakCompare
    return left.displayName.localeCompare(right.displayName, 'ru')
  })

  return assignRanks(sorted, view).map(({ tieBreak: _tieBreak, ...row }) => row)
}
