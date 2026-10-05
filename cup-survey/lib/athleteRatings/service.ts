import { formatAgeYears } from '@/lib/content/tournament-page'
import type { AthleteRatingView } from './constants'
import { aggregateAthleteRatings, rankAthletesForView } from './aggregate'
import { loadAthleteRatingSources } from './loadSources'
import { buildAthleteRatingPublicFormula } from './publicFormula'
import { applyPublicTopLimit } from './publicTopLimit'
import { getAthleteRatingSettings } from './settings'
import type {
  AthleteRatingAdminResponse,
  AthleteRatingPublicResponse,
  AthleteRatingPublicRow,
} from './types'

async function computeRankedRows(view: AthleteRatingView) {
  const settings = await getAthleteRatingSettings()
  const loaded = await loadAthleteRatingSources()
  if (!loaded) {
    return { settings, rows: [] }
  }

  const athletes = aggregateAthleteRatings({
    categories: loaded.categories,
    entryInfoByEntryId: loaded.entryInfoByEntryId,
    settings,
  })

  const rows = rankAthletesForView(athletes, view)
  return { settings, rows }
}

export async function getPublicAthleteRatings(
  view: AthleteRatingView,
): Promise<AthleteRatingPublicResponse | null> {
  const settings = await getAthleteRatingSettings()
  if (!settings.publicEnabled) {
    return null
  }

  const { rows } = await computeRankedRows(view)
  const publicRows = applyPublicTopLimit(rows, settings.publicTopLimit)

  const responseRows: AthleteRatingPublicRow[] = publicRows
    .filter((row) => row.rank != null)
    .map((row) => ({
      rank: row.rank as number,
      athleteId: row.athleteId,
      displayName: row.displayName,
      clubName: row.clubName,
      city: row.city,
      ageLabel: formatAgeYears(row.ageYears),
      resultsSummary: row.resultsSummary,
      wins: row.wins,
      ratingHundredths: row.ratingHundredths,
      ratingFormatted: row.ratingFormatted,
    }))

  return {
    publicEnabled: true,
    topLimit: settings.publicTopLimit,
    discipline: view,
    formula: buildAthleteRatingPublicFormula(settings),
    rows: responseRows,
  }
}

export async function getAdminAthleteRatings(
  view: AthleteRatingView,
): Promise<AthleteRatingAdminResponse> {
  const { settings, rows } = await computeRankedRows(view)
  return { settings, view, rows }
}
