import type { SurveyResponse } from '@prisma/client'
import { getAwardPackageById } from './config/award-packages'
import { belts } from './config/belts'
import { cups, normalizeCupId } from './config/cups'
import { medals } from './config/medals'
import {
  compositionNeedsBelts,
  compositionNeedsCups,
} from './config/prize-compositions'
import { getVenueById } from './config/venues'
import { buildEntryFeeState } from './entryFeeState'
import { syncPrimaryChoice } from './primarySelection'
import type { SurveyFormData } from './surveyDraft'

export type SurveyResponseLike = Pick<
  SurveyResponse,
  | 'acceptableVenues'
  | 'preferredVenue'
  | 'acceptableMedals'
  | 'preferredMedal'
  | 'acceptableBelts'
  | 'preferredBelt'
  | 'acceptableCups'
  | 'preferredCup'
  | 'acceptablePrizeCompositions'
  | 'acceptableAwardPackages'
  | 'representativeName'
  | 'roles'
  | 'rolesOther'
  | 'organizationName'
  | 'city'
  | 'phone'
  | 'athletesCount'
  | 'disciplines'
  | 'dayFormatPreference'
  | 'priorities'
  | 'prioritiesOther'
  | 'comment'
>

export function getPrimaryVenueId(
  response: Pick<SurveyResponseLike, 'acceptableVenues' | 'preferredVenue'>,
): string {
  return syncPrimaryChoice(response.acceptableVenues, response.preferredVenue)
}

export function getPrimaryMedalId(
  response: Pick<SurveyResponseLike, 'acceptableMedals' | 'preferredMedal'>,
): string {
  return syncPrimaryChoice(response.acceptableMedals, response.preferredMedal)
}

export function getPrimaryBeltId(
  response: Pick<
    SurveyResponseLike,
    'acceptableBelts' | 'preferredBelt' | 'acceptablePrizeCompositions'
  >,
): string {
  if (!compositionNeedsBelts(response.acceptablePrizeCompositions)) return 'none'
  const choices = response.acceptableBelts.filter((id) => id !== 'none')
  return syncPrimaryChoice(choices, response.preferredBelt) || 'none'
}

export function getPrimaryCupId(
  response: Pick<
    SurveyResponseLike,
    'acceptableCups' | 'preferredCup' | 'acceptablePrizeCompositions'
  >,
): string {
  if (!compositionNeedsCups(response.acceptablePrizeCompositions)) return 'none'
  const choices = response.acceptableCups
    .map(normalizeCupId)
    .filter((id) => id !== 'none')
  return syncPrimaryChoice(choices, normalizeCupId(response.preferredCup ?? '')) || 'none'
}

export function getPrimaryPackageId(response: SurveyResponseLike): string | null {
  const medalId = getPrimaryMedalId(response)
  if (!medalId) return null
  return `${medalId}_${getPrimaryBeltId(response)}_${getPrimaryCupId(response)}`
}

export function surveyResponseToFormData(response: SurveyResponseLike): SurveyFormData {
  return {
    representativeName: response.representativeName,
    roles: response.roles,
    rolesOther: response.rolesOther ?? '',
    organizationName: response.organizationName,
    city: response.city,
    phone: response.phone,
    athletesCount: response.athletesCount,
    disciplines: response.disciplines,
    acceptableVenues: response.acceptableVenues,
    preferredVenue: response.preferredVenue,
    dayFormatPreference: response.dayFormatPreference,
    acceptableMedals: response.acceptableMedals,
    preferredMedal: response.preferredMedal ?? '',
    acceptableBelts: response.acceptableBelts,
    preferredBelt: response.preferredBelt ?? '',
    acceptableCups: response.acceptableCups,
    preferredCup: response.preferredCup ?? '',
    acceptablePrizeCompositions: response.acceptablePrizeCompositions,
    acceptableAwardPackages: response.acceptableAwardPackages,
    priorities: response.priorities,
    prioritiesOther: response.prioritiesOther ?? '',
    comment: response.comment ?? '',
  }
}

export function getResponseEntryFee(response: SurveyResponseLike): number {
  return buildEntryFeeState(surveyResponseToFormData(response)).total
}

export function getPrimaryVenueLabel(response: SurveyResponseLike): string {
  const venue = getVenueById(getPrimaryVenueId(response))
  return venue ? `${venue.name}, ${venue.city}` : '—'
}

export function getPrimaryMedalLabel(response: SurveyResponseLike): string {
  const medalId = getPrimaryMedalId(response) as keyof typeof medals
  return medals[medalId]?.title ?? '—'
}

export function getPrimaryBeltLabel(response: SurveyResponseLike): string {
  const beltId = getPrimaryBeltId(response) as keyof typeof belts
  return belts[beltId]?.title ?? '—'
}

export function getPrimaryCupLabel(response: SurveyResponseLike): string {
  const cupId = getPrimaryCupId(response) as keyof typeof cups
  return cups[cupId]?.title ?? '—'
}

export function getPrimaryPackageLabel(response: SurveyResponseLike): string {
  const packageId = getPrimaryPackageId(response)
  if (!packageId) return '—'
  return getAwardPackageById(packageId)?.title ?? packageId
}
