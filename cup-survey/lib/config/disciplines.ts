export interface Discipline {
  id: string
  label: string
}

export const disciplines: Discipline[] = [
  { id: 'tactic_control', label: 'Tactic-Control / Тактик Контрол' },
  { id: 'close_control', label: 'Close-Control / Клоус Контрол' },
  { id: 'strike_contact', label: 'Strike Contact / Страйк Контакт' },
  { id: 'strike_light', label: 'Strike Light / Страйк Лайт' },
  { id: 'strike_point', label: 'Strike Point / Страйк Пойнт' },
  { id: 'protect_contact', label: 'Protect Contact / Протек Контакт' },
  { id: 'full_contact', label: 'Full Contact / Фулл Контакт' },
  { id: 'hard_contact', label: 'Hard Contact / Хард Контакт' },
  { id: 'light_contact', label: 'Light Contact / Лайт Контакт' },
]

export const disciplineIds = disciplines.map((d) => d.id)

export function getDisciplineById(id: string): Discipline | undefined {
  return disciplines.find((d) => d.id === id)
}

export function labelForDiscipline(id: string): string {
  return getDisciplineById(id)?.label ?? id
}
