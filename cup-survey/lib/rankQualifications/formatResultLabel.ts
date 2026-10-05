import type { SportRankId } from '@/lib/config/ranks'

const NORM_RANK_LABELS: Record<SportRankId, string> = {
  none: 'без разряда',
  child_1: 'I детского разряда',
  child_2: 'II детского разряда',
  child_3: 'III детского разряда',
  youth_1: 'I юношеского разряда',
  youth_2: 'II юношеского разряда',
  youth_3: 'III юношеского разряда',
  adult_1: 'I взрослого разряда',
  adult_2: 'II взрослого разряда',
  adult_3: 'III взрослого разряда',
  kms: 'КМС',
  ms: 'МС',
  msmk: 'МСМК',
}

export const NORM_QUALIFICATIONS_DISCLAIMER =
  'Информация показывает выполнение нормативов ЕВСК по результатам соревнований.'

export function formatNormRankLabel(rankId: SportRankId): string {
  return NORM_RANK_LABELS[rankId] ?? rankId
}

export function formatAchievedNormResultLabel(rankId: SportRankId): string {
  return `Выполнен норматив ${formatNormRankLabel(rankId)}`
}

function pluralWins(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return 'победа'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'победы'
  return 'побед'
}

export function formatPlacementWins(placement: number | null, wins: number | null): string | null {
  if (placement == null || wins == null) return null
  return `${placement} место · ${wins} ${pluralWins(wins)}`
}

export function formatPlacementWinsWithCategory(
  placement: number | null,
  wins: number | null,
  categoryTitle: string | null | undefined,
): string | null {
  const placementWins = formatPlacementWins(placement, wins)
  const category = categoryTitle?.trim()
  if (!placementWins) return category ?? null
  if (!category) return placementWins
  return `${placementWins} · ${category}`
}

export function formatPlacementWinsSentence(placement: number, wins: number): string {
  return `${placement} место, ${wins} ${pluralWins(wins)}. Норматив ЕВСК выполнен.`
}
