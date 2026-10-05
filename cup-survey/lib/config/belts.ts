export interface BeltOption {
  id: 'none' | 'fourPlus' | 'all'
  title: string
  description: string
  surcharge: number
}

export const belts: Record<'none' | 'fourPlus' | 'all', BeltOption> = {
  none: {
    id: 'none',
    title: 'Без чемпионских поясов',
    description: 'Пояса победителям не вручаются.',
    surcharge: 0,
  },
  fourPlus: {
    id: 'fourPlus',
    title: 'Пояса от 4 участников',
    description: 'Чемпионский пояс победителю в категориях от 4 участников. Доплата к стартовому взносу.',
    surcharge: 750,
  },
  all: {
    id: 'all',
    title: 'Пояса во всех категориях',
    description: 'Чемпионский пояс победителю в каждой категории. Доплата к стартовому взносу.',
    surcharge: 1500,
  },
}

export const beltIds = Object.keys(belts) as Array<keyof typeof belts>
