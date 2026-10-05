export interface ParticipantReorderItem {
  entryId: string
  seedPosition: number
}

/** Меняет местами seedPosition у двух участников. */
export function swapSeedPositions<T extends ParticipantReorderItem>(
  items: T[],
  fromEntryId: string,
  targetSeedPosition: number,
): T[] | null {
  const from = items.find((item) => item.entryId === fromEntryId)
  if (!from || from.seedPosition === targetSeedPosition) return null

  const target = items.find((item) => item.seedPosition === targetSeedPosition)
  if (!target) return null

  return items.map((item) => {
    if (item.entryId === fromEntryId) {
      return { ...item, seedPosition: targetSeedPosition }
    }
    if (item.entryId === target.entryId) {
      return { ...item, seedPosition: from.seedPosition }
    }
    return item
  })
}

export function isValidSeedPosition(position: number, participantCount: number): boolean {
  return Number.isInteger(position) && position >= 1 && position <= participantCount
}

/** Переставляет участника на новую позицию в списке и перенумеровывает посев. */
export function reorderSeedList<T extends ParticipantReorderItem & { seedLocked?: boolean }>(
  items: T[],
  fromEntryId: string,
  toIndex: number,
): T[] | null {
  const sorted = [...items].sort((a, b) => a.seedPosition - b.seedPosition)
  const fromIndex = sorted.findIndex((item) => item.entryId === fromEntryId)
  if (fromIndex < 0 || fromIndex === toIndex) return null

  const moving = sorted[fromIndex]
  if (moving.seedLocked) return null

  const reordered = sorted.filter((_, index) => index !== fromIndex)
  reordered.splice(toIndex, 0, moving)

  for (const item of reordered) {
    if (item.seedLocked) {
      const expectedIndex = item.seedPosition - 1
      if (reordered.indexOf(item) !== expectedIndex) {
        return null
      }
    }
  }

  return reordered.map((item, index) => ({
    ...item,
    seedPosition: index + 1,
  }))
}
