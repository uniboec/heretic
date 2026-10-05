export const roleOptions = [
  {
    id: 'coach',
    label: 'Тренер',
    description: 'Тренирую спортсменов, голосую от команды',
  },
  {
    id: 'club_leader',
    label: 'Руководитель клуба',
    description: 'Директор, президент или иной руководитель спортивной организации',
  },
  {
    id: 'coach_and_leader',
    label: 'Тренер и руководитель клуба',
    description: 'Совмещаю тренерскую и руководящую роль в одном лице',
  },
  {
    id: 'other',
    label: 'Другое',
    description: 'Другой статус — укажите ниже',
  },
] as const

/** Старые значения в уже сохранённых ответах */
export const legacyRoleLabels: Record<string, string> = {
  team_leader: 'Руководитель команды',
  representative: 'Представитель команды',
}

export type RoleId = (typeof roleOptions)[number]['id']

export const dayFormatOptions = [
  { id: 'only_one_day', label: 'Только один день' },
  { id: 'prefer_one_day', label: 'Предпочтительно один день' },
  { id: 'not_important', label: 'Не принципиально' },
  { id: 'two_days_ok', label: 'Два дня подходят' },
] as const

export type DayFormatId = (typeof dayFormatOptions)[number]['id']

export const priorityOptions = [
  { id: 'low_fee', label: 'минимальный стартовый взнос' },
  { id: 'one_day', label: 'проведение турнира в один день' },
  { id: 'location', label: 'удобное расположение площадки' },
  { id: 'venue_quality', label: 'качество и размер спортивной площадки' },
  { id: 'unique_awards', label: 'уникальные награды' },
  { id: 'champion_belts', label: 'наличие чемпионских поясов' },
  { id: 'organization', label: 'высокий организационный уровень' },
  { id: 'accommodation', label: 'минимизация расходов на проживание' },
  { id: 'other', label: 'другое' },
] as const

export type PriorityId = (typeof priorityOptions)[number]['id']

export const roleIds = [...roleOptions.map((r) => r.id), ...Object.keys(legacyRoleLabels)]
export const dayFormatIds = dayFormatOptions.map((d) => d.id)
export const priorityIds = priorityOptions.map((p) => p.id)
