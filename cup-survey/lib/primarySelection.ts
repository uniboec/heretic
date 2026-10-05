/** Поддерживает основной вариант среди выбранных: один — автоматически, несколько — вручную. */
export function syncPrimaryChoice(acceptable: string[], current: string): string {
  if (!acceptable.length) return ''
  if (acceptable.length === 1) return acceptable[0]
  if (current && acceptable.includes(current)) return current
  return ''
}
