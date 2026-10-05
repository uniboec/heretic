import { NextResponse } from 'next/server'
import { tournamentInfo, tournamentDisciplines } from '@/lib/config/tournament'
import { apiErrorResponse } from '@/lib/http/apiErrorResponse'
import { loadRegistrationSchedule } from '@/lib/registration/schedule'
import {
  formatCountdownParts,
  getCurrentRegistrationStage,
  getRegistrationCloseMs,
  getServerNow,
  getStageEndMs,
  isRegistrationClosed,
} from '@/lib/registration/time'
import {
  listActiveCategoryDiscountRules,
  listPublicCategoryDiscountPromotions,
} from '@/lib/registration/categoryDiscounts'
import { getPublicParticipantStats } from '@/lib/registration/service'
import { getPaymentDetails, isCardPaymentConfigured } from '@/lib/registration/payment'
import { getBracketPageSettings } from '@/lib/brackets/service'
import { getActivePublishedGeneration } from '@/lib/brackets/generation/publishedDraws'
import { getAwardsPageSettings } from '@/lib/awards/settings'
import { getBoutsPageSettings } from '@/lib/bouts/service'
import { getNormQualificationsVisibility } from '@/lib/rankQualifications/visibility'
import { getAthleteRatingSettings } from '@/lib/athleteRatings/settings'

const emptyStats = {
  athletes: 0,
  clubs: 0,
  tacticControl: 0,
  closeControl: 0,
  entries: 0,
}

export async function GET() {
  try {
  const schedule = await loadRegistrationSchedule()
  const now = getServerNow()
  const stageId = getCurrentRegistrationStage(now)
  const closed = isRegistrationClosed(now)

  let stats = emptyStats
  let discountRules: Awaited<ReturnType<typeof listActiveCategoryDiscountRules>> = []
  let publicDiscounts: Awaited<ReturnType<typeof listPublicCategoryDiscountPromotions>> = []
  let bracketsPublicEnabled = false
  let bracketsPublished = false
  let boutsPublicEnabled = false
  let boutsPublished = false
  let awardsPublicEnabled = false
  let normQualificationsPublicEnabled = false
  let athleteRatingPublicEnabled = false

  try {
    stats = await getPublicParticipantStats()
    discountRules = await listActiveCategoryDiscountRules(now)
    publicDiscounts = await listPublicCategoryDiscountPromotions(now)
    const bracketSettings = await getBracketPageSettings()
    bracketsPublicEnabled = bracketSettings.publicEnabled
    if (bracketsPublicEnabled) {
      const published = await getActivePublishedGeneration()
      bracketsPublished = Boolean(published)
    }
    const boutsSettings = await getBoutsPageSettings()
    boutsPublicEnabled = boutsSettings.publicEnabled
    if (boutsPublicEnabled) {
      const published = await getActivePublishedGeneration()
      boutsPublished = Boolean(published)
    }
    const awardsSettings = await getAwardsPageSettings()
    awardsPublicEnabled = awardsSettings.publicEnabled
    const normVisibility = await getNormQualificationsVisibility()
    normQualificationsPublicEnabled = normVisibility.normQualificationsPublicEnabled
    const athleteRatingSettings = await getAthleteRatingSettings()
    athleteRatingPublicEnabled = athleteRatingSettings.publicEnabled
  } catch (error) {
    console.error('GET /api/tournament/state: database unavailable', error)
  }

  const stage = stageId ? schedule.stagesById[stageId] : null
  const closeCountdown = formatCountdownParts(getRegistrationCloseMs(), now)
  const stageCountdown = stageId ? formatCountdownParts(getStageEndMs(stageId), now) : null

  return NextResponse.json({
    now: now.toISOString(),
    closed,
    registrationClosesAt: schedule.registrationClosesAt,
    stage: stage
      ? {
          id: stage.id,
          label: stage.label,
          bannerTitle: stage.bannerTitle,
          bannerDetail: stage.bannerDetail,
          endsAt: stage.endsAt,
          pricePerDiscipline: stage.pricePerDiscipline,
          countdown: stageCountdown,
        }
      : null,
    closeCountdown,
    tournament: tournamentInfo,
    disciplines: tournamentDisciplines,
    stages: schedule.stagesList,
    stats,
    discountRules,
    publicDiscounts,
    maxAthletes: schedule.showMaxAthletes ? schedule.maxAthletes : null,
    bracketsPublicEnabled,
    bracketsPublished,
    boutsPublicEnabled,
    boutsPublished,
    awardsPublicEnabled,
    normQualificationsPublicEnabled,
    athleteRatingPublicEnabled,
    paymentConfigured: (() => {
      const payment = getPaymentDetails()
      return Boolean(
        isCardPaymentConfigured(payment) ||
          payment.account ||
          payment.recipientName,
      )
    })(),
  })
  } catch (error) {
    console.error('GET /api/tournament/state failed', error)
    return apiErrorResponse(error)
  }
}
