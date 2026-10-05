import { BoutsValidationError } from './errors'

export function listRunnableMatBoutIds(
  matBoutIds: readonly string[],
  completedBoutIds: ReadonlySet<string>,
): string[] {
  return matBoutIds.filter((boutId) => !completedBoutIds.has(boutId))
}

function cascadeSkipSet(
  boutId: string,
  cascadeBoutIds?: ReadonlySet<string>,
): ReadonlySet<string> {
  return cascadeBoutIds ?? new Set([boutId])
}

export function getMaxPostponeSkip(
  matBoutIds: readonly string[],
  boutId: string,
  cascadeBoutIds?: ReadonlySet<string>,
): number {
  const boutIndex = matBoutIds.indexOf(boutId)
  if (boutIndex < 0) return 0

  const skipSet = cascadeSkipSet(boutId, cascadeBoutIds)
  let count = 0
  for (let index = boutIndex + 1; index < matBoutIds.length; index += 1) {
    if (!skipSet.has(matBoutIds[index]!)) count += 1
  }
  return count
}

export function resolvePostponeAnchorId(
  matBoutIds: readonly string[],
  boutId: string,
  postponeBy: number,
  cascadeBoutIds?: ReadonlySet<string>,
): string {
  const boutIndex = matBoutIds.indexOf(boutId)
  if (boutIndex < 0) {
    throw new BoutsValidationError('Поединок не найден на ковре')
  }

  const skipSet = cascadeSkipSet(boutId, cascadeBoutIds)
  const maxSkip = getMaxPostponeSkip(matBoutIds, boutId, skipSet)
  if (maxSkip <= 0) {
    throw new BoutsValidationError('Нет поединков, после которых можно перенести')
  }
  if (!Number.isInteger(postponeBy) || postponeBy < 1 || postponeBy > maxSkip) {
    throw new BoutsValidationError(`Укажите перенос на 1–${maxSkip} поединков`)
  }

  let counted = 0
  for (let index = boutIndex + 1; index < matBoutIds.length; index += 1) {
    const candidate = matBoutIds[index]!
    if (skipSet.has(candidate)) continue
    counted += 1
    if (counted === postponeBy) return candidate
  }

  throw new BoutsValidationError('Якорный поединок не найден в очереди ковра')
}

export function formatPostponeSkipLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} поединок`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} поединка`
  }
  return `${count} поединков`
}
