export interface CupOption {
  id: 'none' | 'fourPlus' | 'all' | 'custom_fourPlus' | 'custom_all'
  title: string
  description: string
  surcharge: number
}

export const cups: Record<CupOption['id'], CupOption> = {
  none: {
    id: 'none',
    title: 'Без кубков',
    description: 'Кубки победителям не вручаются.',
    surcharge: 0,
  },
  fourPlus: {
    id: 'fourPlus',
    title: 'Кубки в категориях от 4 человек',
    description: 'Кубок победителю в категориях от 4 участников. Доплата к стартовому взносу.',
    surcharge: 250,
  },
  all: {
    id: 'all',
    title: 'Кубки во всех категориях',
    description: 'Кубок победителю в каждой категории. Доплата к стартовому взносу.',
    surcharge: 500,
  },
  custom_fourPlus: {
    id: 'custom_fourPlus',
    title: 'Уникальные кубки в категориях от 4 человек',
    description: 'Индивидуальный дизайн в категориях от 4 участников. Доплата к стартовому взносу.',
    surcharge: 750,
  },
  custom_all: {
    id: 'custom_all',
    title: 'Уникальные кубки во всех категориях',
    description: 'Индивидуальный дизайн в каждой категории. Доплата к стартовому взносу.',
    surcharge: 1500,
  },
}

export const cupIds = Object.keys(cups) as Array<CupOption['id']>

const legacyCupIds: Record<string, CupOption['id']> = {
  standard_fourPlus: 'fourPlus',
}

export function normalizeCupId(id: string): CupOption['id'] {
  if (id in cups) return id as CupOption['id']
  return legacyCupIds[id] ?? 'none'
}
