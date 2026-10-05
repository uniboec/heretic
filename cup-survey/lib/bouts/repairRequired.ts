/** Computed admin signal — not persisted. */
export function isBoutsRepairRequired(input: {
  visible: boolean
  boutsReleased: boolean
  storedMatIndex: number | null
  matCount: number
}): boolean {
  if (!input.visible) return false
  if (input.boutsReleased) return false
  if (input.storedMatIndex == null) return input.matCount < 1
  return input.storedMatIndex < 1 || input.storedMatIndex > input.matCount
}

export function boutsRepairRequiredMessage(storedMatIndex: number | null, matCount: number): string {
  if (storedMatIndex != null && storedMatIndex > matCount) {
    return `Ковёр ${storedMatIndex} больше недоступен. Выберите ковёр или Авто, затем добавьте в расписание.`
  }
  if (matCount < 1) {
    return 'Сначала укажите количество ковров, затем добавьте в расписание.'
  }
  return 'Выберите ковёр или Авто, затем добавьте в расписание.'
}
