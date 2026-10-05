export const TOURNAMENT_TIMEZONE = 'Asia/Yekaterinburg'

/** Scope id for mat-control runtime tables (multi-tournament ready). */
export const TOURNAMENT_SCOPE_ID = 'cup-2026'

export const tournamentInfo = {
  title: 'Кубок Свердловской области по смешанным единоборствам',
  subtitle: '2026',
  eventDate: '2026-10-03',
  eventDateLabel: '3 октября 2026',
  organizer: 'РФСОО «Федерация Смешанных Единоборств Свердловской области»',
  disciplinesLabel: 'Tactic-Control • Close-Control',
  contacts: {
    phone: '8 (343) 22-64-222',
    email: 'mmaural@yandex.ru',
    vk: 'https://vk.me/mmaural',
    vkLabel: 'ВКонтакте',
    site: 'cup26.mma66.ru',
  },
  venue: {
    name: 'СК «Универсальные бойцы»',
    city: 'Первоуральск',
    region: 'Свердловская область',
    mats: 2,
    address: '', // заполнить перед публикацией
    mapUrl: '', // заполнить перед публикацией
    mapEmbedUrl: '', // опционально
  },
  poster: {
    src: '/images/cup-2026-poster.png',
    width: 682,
    height: 1024,
    alt: 'Кубок Свердловской области по смешанным единоборствам — 3 октября 2026, Первоуральск',
  },
}

export type RegistrationStageId = string

export interface RegistrationStageConfig {
  id: string
  label: string
  /** Текст для баннера текущего этапа */
  bannerTitle: string
  bannerDetail: string
  startsAt: string | null
  endsAt: string
  pricePerDiscipline: number
}

export const registrationStages: Record<RegistrationStageId, RegistrationStageConfig> = {
  early: {
    id: 'early',
    label: 'Ранняя регистрация',
    bannerTitle: 'Ранняя регистрация',
    bannerDetail: 'до 21 сентября',
    startsAt: null,
    endsAt: '2026-09-21T23:59:59+05:00',
    pricePerDiscipline: 1500,
  },
  regular: {
    id: 'regular',
    label: 'Основная регистрация',
    bannerTitle: 'Основная регистрация',
    bannerDetail: 'до 24 сентября',
    startsAt: '2026-09-22T00:00:00+05:00',
    endsAt: '2026-09-24T23:59:59+05:00',
    pricePerDiscipline: 1800,
  },
  late: {
    id: 'late',
    label: 'Поздняя регистрация',
    bannerTitle: 'Поздняя регистрация',
    bannerDetail: '25 сентября, до 17:00',
    startsAt: '2026-09-25T00:00:00+05:00',
    endsAt: '2026-09-25T17:00:00+05:00',
    pricePerDiscipline: 2000,
  },
}

export const registrationStagesList = (
  Object.values(registrationStages) as RegistrationStageConfig[]
).map((stage) => ({
  id: stage.id,
  label: stage.label,
  period:
    stage.id === 'early'
      ? 'до 21 сентября'
      : stage.id === 'regular'
        ? '22–24 сентября'
        : '25 сентября, до 17:00',
  pricePerDiscipline: stage.pricePerDiscipline,
}))

export const registrationClosesAt = '2026-09-25T17:00:00+05:00'

export const PRICE_PER_DISCIPLINE_DEFAULT = 1500

export const PRICE_HOLD_HOURS = 24

/** Сколько часов после закрытия этапа можно подтвердить оплату по его тарифу без чека. */
export const PREVIOUS_STAGE_GRACE_HOURS = 72

/** Лимит участников по умолчанию, если в админке не задан. null — без лимита. */
export const DEFAULT_MAX_ATHLETES: number | null = null
export const DEFAULT_SHOW_MAX_ATHLETES = false

/** На дату соревнований: спортсмены до этого возраста могут заявиться ещё и в следующую возрастную группу */
export const CHILD_AGE_UP_MAX_AGE = 17

export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024
export const PAYMENT_PROOF_ALLOWED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
] as const

export const tournamentDisciplines = [
  {
    id: 'tactic_control' as const,
    label: 'Tactic-Control',
    labelRu: 'Тактик Контрол',
  },
  {
    id: 'close_control' as const,
    label: 'Close-Control',
    labelRu: 'Клоус Контрол',
  },
] as const

export type TournamentDisciplineId = (typeof tournamentDisciplines)[number]['id']

export const disciplineIds = tournamentDisciplines.map((d) => d.id)

export function getDisciplineLabel(id: string, short = false): string {
  const d = tournamentDisciplines.find((x) => x.id === id)
  if (!d) return id
  return short ? d.label : `${d.label} (${d.labelRu})`
}

/** Краткое русское название дисциплины для списков и таблиц. */
export function getDisciplineShortLabel(id: string): string {
  const d = tournamentDisciplines.find((x) => x.id === id)
  if (!d) return id
  return d.labelRu
}

export const genderOptions = [
  { id: 'male' as const, label: 'Мужской' },
  { id: 'female' as const, label: 'Женский' },
] as const

export type GenderId = (typeof genderOptions)[number]['id']
