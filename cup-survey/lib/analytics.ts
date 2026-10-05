import type { SurveyResponse } from '@prisma/client'
import { awardPackages } from './config/award-packages'
import { belts } from './config/belts'
import { cups } from './config/cups'
import { disciplines, labelForDiscipline } from './config/disciplines'
import { dayFormatOptions, legacyRoleLabels, priorityOptions, roleOptions } from './config/enums'
import { medals } from './config/medals'
import { prizeCompositions } from './config/prize-compositions'
import { getVenueById, venues } from './config/venues'
import { formatMoney } from './formatMoney'
import {
  getPrimaryBeltId,
  getPrimaryCupId,
  getPrimaryMedalId,
  getPrimaryPackageId,
  getPrimaryVenueId,
  getResponseEntryFee,
} from './surveyResponse'

export interface TeamStat {
  id: string
  label: string
  teamsCount: number
  teamsPercent: number
  teamsWithAthleteData: number
  athletesCount: number
  athletesPercent: number
}

export interface ScenarioRow {
  venueId: string
  venueName: string
  packageId: string
  packageLabel: string
  totalEntryFee: number
  teamsCount: number
  teamsPercent: number
  athletesCount: number
  athletesPercent: number
}

export interface EntryFeeStat {
  total: number
  label: string
  teamsCount: number
  teamsPercent: number
  athletesCount: number
  athletesPercent: number
}

export interface AdminStats {
  totalResponses: number
  totalKnownAthletes: number
  teamsWithAthleteData: number
  venueStats: TeamStat[]
  preferredVenueStats: TeamStat[]
  preferredMedalStats: TeamStat[]
  preferredBeltStats: TeamStat[]
  preferredCupStats: TeamStat[]
  dayFormatStats: TeamStat[]
  disciplineStats: TeamStat[]
  prizeCompositionStats: TeamStat[]
  awardPackageStats: TeamStat[]
  primaryAwardPackageStats: TeamStat[]
  entryFeeStats: EntryFeeStat[]
  scenarioMatrix: ScenarioRow[]
  possibleDuplicates: Array<{ organizationName: string; phone: string; count: number }>
  athleteDataNote: string
}

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 1000) / 10
}

function labelForRole(id: string): string {
  return roleOptions.find((r) => r.id === id)?.label ?? legacyRoleLabels[id] ?? id
}

function buildCountStats(
  responses: SurveyResponse[],
  total: number,
  totalKnownAthletes: number,
  options: Array<{ id: string; label: string }>,
  matches: (response: SurveyResponse, optionId: string) => boolean,
): TeamStat[] {
  return options.map((option) => {
    const supporting = responses.filter((response) => matches(response, option.id))
    const supportingWithAthletes = supporting.filter((response) => response.athletesCount != null)
    const athletes = supportingWithAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

    return {
      id: option.id,
      label: option.label,
      teamsCount: supporting.length,
      teamsPercent: pct(supporting.length, total),
      teamsWithAthleteData: supportingWithAthletes.length,
      athletesCount: athletes,
      athletesPercent: pct(athletes, totalKnownAthletes),
    }
  })
}

function buildPackageStats(
  responses: SurveyResponse[],
  total: number,
  totalKnownAthletes: number,
  matches: (response: SurveyResponse, packageId: string) => boolean,
): TeamStat[] {
  return awardPackages
    .map((pkg) => {
      const supporting = responses.filter((response) => matches(response, pkg.id))
      const supportingWithAthletes = supporting.filter((response) => response.athletesCount != null)
      const athletes = supportingWithAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

      return {
        id: pkg.id,
        label: pkg.title,
        teamsCount: supporting.length,
        teamsPercent: pct(supporting.length, total),
        teamsWithAthleteData: supportingWithAthletes.length,
        athletesCount: athletes,
        athletesPercent: pct(athletes, totalKnownAthletes),
      }
    })
    .filter((row) => row.teamsCount > 0)
    .sort((a, b) => b.teamsCount - a.teamsCount)
}

export function buildAdminStats(responses: SurveyResponse[]): AdminStats {
  const total = responses.length
  const withAthletes = responses.filter((response) => response.athletesCount != null && response.athletesCount > 0)
  const totalKnownAthletes = withAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

  const athleteDataNote =
    `Данные по количеству спортсменов предоставили ${withAthletes.length} из ${total} команд.`

  const venueStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    venues.map((venue) => ({ id: venue.id, label: venue.name })),
    (response, venueId) => response.acceptableVenues.includes(venueId),
  )

  const preferredVenueStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    venues.map((venue) => ({ id: venue.id, label: venue.name })),
    (response, venueId) => getPrimaryVenueId(response) === venueId,
  )

  const preferredMedalStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    Object.values(medals).map((medal) => ({ id: medal.id, label: medal.title })),
    (response, medalId) => getPrimaryMedalId(response) === medalId,
  )

  const preferredBeltStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    Object.values(belts)
      .filter((belt) => belt.id !== 'none')
      .map((belt) => ({ id: belt.id, label: belt.title })),
    (response, beltId) => getPrimaryBeltId(response) === beltId,
  )

  const preferredCupStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    Object.values(cups)
      .filter((cup) => cup.id !== 'none')
      .map((cup) => ({ id: cup.id, label: cup.title })),
    (response, cupId) => getPrimaryCupId(response) === cupId,
  )

  const dayFormatStats = buildCountStats(
    responses,
    total,
    totalKnownAthletes,
    dayFormatOptions.map((option) => ({ id: option.id, label: option.label })),
    (response, optionId) => response.dayFormatPreference === optionId,
  )

  const disciplineStats = disciplines.map((discipline) => {
    const supporting = responses.filter((response) => response.disciplines.includes(discipline.id))
    const supportingWithAthletes = supporting.filter((response) => response.athletesCount != null)
    const athletes = supportingWithAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

    return {
      id: discipline.id,
      label: discipline.label,
      teamsCount: supporting.length,
      teamsPercent: pct(supporting.length, total),
      teamsWithAthleteData: supportingWithAthletes.length,
      athletesCount: athletes,
      athletesPercent: pct(athletes, totalKnownAthletes),
    }
  })

  const prizeCompositionStats = prizeCompositions.map((composition) => {
    const supporting = responses.filter((response) =>
      response.acceptablePrizeCompositions.includes(composition.id),
    )
    const supportingWithAthletes = supporting.filter((response) => response.athletesCount != null)
    const athletes = supportingWithAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

    return {
      id: composition.id,
      label: composition.title,
      teamsCount: supporting.length,
      teamsPercent: pct(supporting.length, total),
      teamsWithAthleteData: supportingWithAthletes.length,
      athletesCount: athletes,
      athletesPercent: pct(athletes, totalKnownAthletes),
    }
  })

  const awardPackageStats = buildPackageStats(
    responses,
    total,
    totalKnownAthletes,
    (response, packageId) => response.acceptableAwardPackages.includes(packageId),
  )

  const primaryAwardPackageStats = buildPackageStats(
    responses,
    total,
    totalKnownAthletes,
    (response, packageId) => getPrimaryPackageId(response) === packageId,
  )

  const entryFeeMap = new Map<number, SurveyResponse[]>()
  for (const response of responses) {
    const fee = getResponseEntryFee(response)
    const bucket = entryFeeMap.get(fee) ?? []
    bucket.push(response)
    entryFeeMap.set(fee, bucket)
  }

  const entryFeeStats: EntryFeeStat[] = Array.from(entryFeeMap.entries())
    .map(([fee, bucket]) => {
      const supportingWithAthletes = bucket.filter((response) => response.athletesCount != null)
      const athletes = supportingWithAthletes.reduce((sum, response) => sum + (response.athletesCount ?? 0), 0)

      return {
        total: fee,
        label: formatMoney(fee, { plus: false }),
        teamsCount: bucket.length,
        teamsPercent: pct(bucket.length, total),
        athletesCount: athletes,
        athletesPercent: pct(athletes, totalKnownAthletes),
      }
    })
    .sort((a, b) => a.total - b.total)

  const scenarioMap = new Map<string, ScenarioRow>()
  for (const response of responses) {
    const venueId = getPrimaryVenueId(response)
    const packageId = getPrimaryPackageId(response)
    if (!venueId || !packageId) continue

    const venue = getVenueById(venueId)
    const pkg = awardPackages.find((item) => item.id === packageId)
    if (!venue || !pkg) continue

    const key = `${venueId}:${packageId}`
    const existing = scenarioMap.get(key)
    const athletes = response.athletesCount ?? 0

    if (existing) {
      existing.teamsCount += 1
      existing.athletesCount += athletes
    } else {
      scenarioMap.set(key, {
        venueId,
        venueName: venue.name,
        packageId,
        packageLabel: pkg.title,
        totalEntryFee: getResponseEntryFee(response),
        teamsCount: 1,
        teamsPercent: 0,
        athletesCount: athletes,
        athletesPercent: 0,
      })
    }
  }

  const scenarioMatrix = Array.from(scenarioMap.values())
    .map((row) => ({
      ...row,
      teamsPercent: pct(row.teamsCount, total),
      athletesPercent: pct(row.athletesCount, totalKnownAthletes),
    }))
    .sort((a, b) => b.teamsCount - a.teamsCount)

  const dupMap = new Map<string, number>()
  for (const response of responses) {
    const key = `${response.organizationName}::${response.phone}`
    dupMap.set(key, (dupMap.get(key) ?? 0) + 1)
  }
  const possibleDuplicates = Array.from(dupMap.entries())
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const [organizationName, phone] = key.split('::')
      return { organizationName, phone, count }
    })

  return {
    totalResponses: total,
    totalKnownAthletes,
    teamsWithAthleteData: withAthletes.length,
    venueStats,
    preferredVenueStats,
    preferredMedalStats,
    preferredBeltStats,
    preferredCupStats,
    dayFormatStats,
    disciplineStats,
    prizeCompositionStats,
    awardPackageStats,
    primaryAwardPackageStats,
    entryFeeStats,
    scenarioMatrix,
    possibleDuplicates,
    athleteDataNote,
  }
}

export function labelForPriority(id: string): string {
  return priorityOptions.find((p) => p.id === id)?.label ?? id
}

export function labelForRoleExport(id: string): string {
  return labelForRole(id)
}

export function labelForDisciplineExport(id: string): string {
  return labelForDiscipline(id)
}
