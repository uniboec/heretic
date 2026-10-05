import { listPublicCategoryDiscountPromotions } from '@/lib/registration/categoryDiscounts'
import { loadRegistrationSchedule } from '@/lib/registration/schedule'
import { getPublicParticipantStats } from '@/lib/registration/service'
import {
  getCurrentRegistrationStage,
  getServerNow,
  isRegistrationClosed,
} from '@/lib/registration/time'
import type { PublicCategoryDiscountPromotion } from '@/lib/registration/categoryDiscounts'

const emptyStats = {
  athletes: 0,
  clubs: 0,
  tacticControl: 0,
  closeControl: 0,
  entries: 0,
}

export type TournamentPageState = {
  closed: boolean
  registrationClosesAt: string
  stage: {
    id: string
    label: string
    pricePerDiscipline: number
    bannerDetail?: string
  } | null
  stages: Array<{
    id: string
    label: string
    period: string
    pricePerDiscipline: number
  }>
  stats: typeof emptyStats
  publicDiscounts: PublicCategoryDiscountPromotion[]
}

export async function loadTournamentPageState(): Promise<TournamentPageState> {
  const schedule = await loadRegistrationSchedule()
  const now = getServerNow()
  const stageId = getCurrentRegistrationStage(now)
  const closed = isRegistrationClosed(now)
  const stage = stageId ? schedule.stagesById[stageId] : null

  let stats = emptyStats
  let publicDiscounts: PublicCategoryDiscountPromotion[] = []

  try {
    stats = await getPublicParticipantStats()
    publicDiscounts = await listPublicCategoryDiscountPromotions(now)
  } catch (error) {
    console.error('loadTournamentPageState: database unavailable', error)
  }

  return {
    closed,
    registrationClosesAt: schedule.registrationClosesAt,
    stage: stage
      ? {
          id: stage.id,
          label: stage.label,
          pricePerDiscipline: stage.pricePerDiscipline,
          bannerDetail: stage.bannerDetail,
        }
      : null,
    stages: schedule.stagesList,
    stats,
    publicDiscounts,
  }
}
