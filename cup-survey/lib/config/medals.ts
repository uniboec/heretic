export interface MedalOption {
  id: 'standard' | 'custom'
  title: string
  description: string
  surcharge: number
}

export const medals: Record<'standard' | 'custom', MedalOption> = {
  standard: {
    id: 'standard',
    title: 'Стандартные медали',
    description: 'Медаль ~50 мм с тематической наклейкой. Доплата к стартовому взносу.',
    surcharge: 100,
  },
  custom: {
    id: 'custom',
    title: 'Уникальные медали',
    description: 'Индивидуальный дизайн для Кубка Свердловской области. Доплата к стартовому взносу.',
    surcharge: 300,
  },
}

export const medalIds = Object.keys(medals) as Array<keyof typeof medals>
