import { applyClubDiscount } from './pricing'
import { resolveRegistrationStageId } from './registrationStageId'
import { getRegistrationScheduleSync } from './schedule'
import { getCurrentRegistrationStage, getServerNow } from './time'

let lastSyncedStageId: string | null = null

/** Базовая цена этапа для пересчёта неоплаченных категорий (текущий этап, не этап заявки). */
export function getEffectiveStageIdForUnpaidEntries(fallbackStageId: string): string {
  const resolvedFallback = resolveRegistrationStageId(fallbackStageId)
  return getCurrentRegistrationStage(getServerNow()) ?? resolvedFallback
}

export function getEffectiveBasePriceForUnpaidEntries(fallbackStageId: string): number {
  const stageId = getEffectiveStageIdForUnpaidEntries(fallbackStageId)
  return getRegistrationScheduleSync().stagesById[stageId]?.pricePerDiscipline ?? 0
}

export function getEffectivePricePerDisciplineForUnpaidEntries(
  fallbackStageId: string,
  clubDiscountPercent: number | null | undefined,
): number {
  return applyClubDiscount(
    getEffectiveBasePriceForUnpaidEntries(fallbackStageId),
    clubDiscountPercent,
  )
}

/** Пересчитывает неоплаченные категории при смене этапа регистрации. */
export async function syncUnpaidPricesForCurrentStage(): Promise<void> {
  const currentStageId = getCurrentRegistrationStage(getServerNow())
  if (!currentStageId) {
    lastSyncedStageId = null
    return
  }
  if (currentStageId === lastSyncedStageId) return

  const { recalculateAllUnpaidEntryPrices } = await import('./categoryDiscounts')
  await recalculateAllUnpaidEntryPrices()
  lastSyncedStageId = currentStageId
}

export async function ensureUnpaidPricesMatchCurrentStage(): Promise<void> {
  const { loadRegistrationSchedule } = await import('./schedule')
  await loadRegistrationSchedule()
}

/** Сброс кэша этапа (для тестов и после правки расписания). */
export function resetUnpaidStagePricingSync(): void {
  lastSyncedStageId = null
}
