export interface SportRankOption {
  id: string
  label: string
}

export interface SportRankGroup {
  label: string
  options: SportRankOption[]
}

export const sportRankGroups: SportRankGroup[] = [
  {
    label: 'Без разряда',
    options: [{ id: 'none', label: 'Без разряда' }],
  },
  {
    label: 'Детские разряды',
    options: [
      { id: 'child_3', label: '3 детский разряд' },
      { id: 'child_2', label: '2 детский разряд' },
      { id: 'child_1', label: '1 детский разряд' },
    ],
  },
  {
    label: 'Юношеские разряды',
    options: [
      { id: 'youth_3', label: '3 юношеский разряд' },
      { id: 'youth_2', label: '2 юношеский разряд' },
      { id: 'youth_1', label: '1 юношеский разряд' },
    ],
  },
  {
    label: 'Взрослые разряды',
    options: [
      { id: 'adult_3', label: '3 взрослый разряд' },
      { id: 'adult_2', label: '2 взрослый разряд' },
      { id: 'adult_1', label: '1 взрослый разряд' },
    ],
  },
  {
    label: 'Спортивные звания',
    options: [
      { id: 'kms', label: 'КМС' },
      { id: 'ms', label: 'МС' },
      { id: 'msmk', label: 'МСМК' },
    ],
  },
]

export const sportRankOptions = sportRankGroups.flatMap((group) => group.options)

export const sportRankIds = sportRankOptions.map((option) => option.id)

export type SportRankId = (typeof sportRankOptions)[number]['id']

export function getSportRankLabel(id: string | null | undefined): string {
  if (!id) return 'Без разряда'
  const option = sportRankOptions.find((item) => item.id === id)
  return option?.label ?? id
}

export function normalizeSportRankId(value: string | null | undefined): SportRankId {
  if (!value || value === 'Нет') return 'none'
  if (sportRankIds.includes(value)) return value as SportRankId
  return 'none'
}
