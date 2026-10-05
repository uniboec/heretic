export interface Venue {
  id: string
  name: string
  city: string
  days: 1 | 2
  mats: number
  surcharge: number
  description: string
  warning?: string
  limitedCapacity?: boolean
}

export const venues: Venue[] = [
  {
    id: 'universal-fighters',
    name: 'СК «Универсальные бойцы»',
    city: 'Первоуральск',
    days: 2,
    mats: 2,
    surcharge: 0,
    limitedCapacity: true,
    description: '',
    warning: 'Компактный зал: только 2 дня, до 2 ковров, мало мест для зрителей.',
  },
  {
    id: 'forum-metallurg',
    name: 'СК «Форум Металлург»',
    city: 'Нижний Тагил',
    days: 1,
    mats: 4,
    surcharge: 300,
    description: '',
  },
  {
    id: 'gtm',
    name: 'GTM — Global Team Management',
    city: 'Екатеринбург',
    days: 2,
    mats: 2,
    surcharge: 350,
    description: '',
    warning: 'Возможны расходы на проживание.',
  },
  {
    id: 'ratiborets',
    name: '«Ратиборец»',
    city: 'Екатеринбург',
    days: 2,
    mats: 3,
    surcharge: 800,
    description: '',
    warning: 'Возможны расходы на проживание.',
  },
  {
    id: 'rodina',
    name: '«Родина»',
    city: 'Екатеринбург',
    days: 1,
    mats: 4,
    surcharge: 900,
    description: '',
  },
]

export const venueIds = venues.map((v) => v.id)

export function getVenueById(id: string): Venue | undefined {
  return venues.find((v) => v.id === id)
}
