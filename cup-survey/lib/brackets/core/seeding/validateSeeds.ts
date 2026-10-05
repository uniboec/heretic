export interface SeedPositionItem {
  entryId: string
  seedPosition: number
}

export type SeedValidationCode =
  | 'INVALID_SEED_RANGE'
  | 'DUPLICATE_SEED'
  | 'INCOMPLETE_SEED_SET'
  | 'SEED_LOCKED'

export interface SeedValidationIssue {
  code: SeedValidationCode
  message: string
}

/** Сжимает позиции посева к непрерывному диапазону 1..N, сохраняя относительный порядок. */
export function compactSeedPositions<T extends { seedPosition: number }>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.seedPosition - b.seedPosition)
    .map((item, index) => ({ ...item, seedPosition: index + 1 }))
}

export function validateSeedPositions(
  seedPositions: number[],
  participantCount: number,
): SeedValidationIssue | null {
  if (participantCount < 0) {
    return { code: 'INVALID_SEED_RANGE', message: 'Некорректное число участников' }
  }

  if (seedPositions.length !== participantCount) {
    return {
      code: 'INCOMPLETE_SEED_SET',
      message: 'Количество позиций посева не совпадает с числом участников',
    }
  }

  for (const position of seedPositions) {
    if (!Number.isInteger(position) || position < 1 || position > participantCount) {
      return {
        code: 'INVALID_SEED_RANGE',
        message: `Позиция посева должна быть от 1 до ${participantCount}`,
      }
    }
  }

  if (new Set(seedPositions).size !== seedPositions.length) {
    return { code: 'DUPLICATE_SEED', message: 'Дублирующиеся позиции посева' }
  }

  return null
}

export function validateParticipantSeedUpdates(
  updates: SeedPositionItem[],
  expectedEntryIds: Iterable<string>,
): SeedValidationIssue | null {
  const expected = new Set(expectedEntryIds)
  if (updates.length !== expected.size) {
    return {
      code: 'INCOMPLETE_SEED_SET',
      message: 'Список участников неполный или содержит лишние записи',
    }
  }

  for (const update of updates) {
    if (!expected.has(update.entryId)) {
      return {
        code: 'INCOMPLETE_SEED_SET',
        message: 'Неизвестный участник в списке посева',
      }
    }
  }

  return validateSeedPositions(
    updates.map((item) => item.seedPosition),
    expected.size,
  )
}

export function validateParticipantSeedUpdatesWithLocks(
  updates: SeedPositionItem[],
  existingParticipants: Array<{ entryId: string; seedPosition: number; seedLocked: boolean }>,
): SeedValidationIssue | null {
  const base = validateParticipantSeedUpdates(
    updates,
    existingParticipants.map((participant) => participant.entryId),
  )
  if (base) return base

  const existingById = new Map(existingParticipants.map((participant) => [participant.entryId, participant]))
  for (const update of updates) {
    const existing = existingById.get(update.entryId)
    if (existing?.seedLocked && update.seedPosition !== existing.seedPosition) {
      return {
        code: 'SEED_LOCKED',
        message: `Позиция участника ${update.entryId} зафиксирована и не может быть изменена`,
      }
    }
  }

  return null
}
