import { formatAthleteFullName } from '@/lib/registration/athleteName'
import { getCategoryTitleFromKey } from '@/lib/registration/categoryIdentity'
import { TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import type { ScheduledCeremonyCategory } from './buildCeremonySchedule'

export function formatCeremonyTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatCeremonyEstimatedLabel(timing: ScheduledCeremonyCategory['timing']): string {
  if (timing.actualEndAt) {
    return formatCeremonyTime(timing.actualEndAt)
  }
  return `≈${formatCeremonyTime(timing.estimatedStartAt)}`
}

export function placementDisplayName(placement: {
  lastName: string
  firstName: string
  middleName?: string | null
}): string {
  return formatAthleteFullName(placement)
}

export function categoryTitleForKey(categoryKey: string): string {
  return getCategoryTitleFromKey(categoryKey)
}

export function medalEmoji(placement: number): string {
  if (placement === 1) return '🥇'
  if (placement === 2) return '🥈'
  if (placement === 3) return '🥉'
  return '🏅'
}
