import { belts } from './belts'
import { cups } from './cups'
import { medals } from './medals'
import type { PrizeCompositionId } from './prize-compositions'

export interface AwardPackage {
  id: string
  medalId: keyof typeof medals
  beltId: keyof typeof belts
  cupId: keyof typeof cups
  title: string
  description: string
  surcharge: number
  compositionId: PrizeCompositionId
}

function getCompositionId(
  beltId: keyof typeof belts,
  cupId: keyof typeof cups,
): PrizeCompositionId {
  const hasBelts = beltId !== 'none'
  const hasCups = cupId !== 'none'
  if (!hasBelts && !hasCups) return 'medals_only'
  if (hasBelts && !hasCups) return 'medals_belts'
  if (!hasBelts && hasCups) return 'medals_cups'
  return 'medals_belts_cups'
}

function buildPackage(
  medalId: keyof typeof medals,
  beltId: keyof typeof belts,
  cupId: keyof typeof cups,
): AwardPackage {
  const medal = medals[medalId]
  const belt = belts[beltId]
  const cup = cups[cupId]
  const surcharge = medal.surcharge + belt.surcharge + cup.surcharge
  const compositionId = getCompositionId(beltId, cupId)

  const extras: string[] = []
  if (beltId !== 'none') extras.push(belt.title.toLowerCase())
  if (cupId !== 'none') extras.push(cup.title.toLowerCase())

  const title =
    extras.length === 0
      ? medal.title
      : `${medal.title} · ${extras.join(' · ')}`

  const descriptionParts = [medal.description]
  if (beltId !== 'none') descriptionParts.push(belt.description)
  if (cupId !== 'none') descriptionParts.push(cup.description)

  return {
    id: `${medalId}_${beltId}_${cupId}`,
    medalId,
    beltId,
    cupId,
    title,
    description: descriptionParts.filter(Boolean).join(' '),
    surcharge,
    compositionId,
  }
}

export const awardPackages: AwardPackage[] = (
  Object.keys(medals) as Array<keyof typeof medals>
).flatMap((medalId) =>
  (Object.keys(belts) as Array<keyof typeof belts>).flatMap((beltId) =>
    (Object.keys(cups) as Array<keyof typeof cups>).map((cupId) =>
      buildPackage(medalId, beltId, cupId),
    ),
  ),
)

export const awardPackageIds = awardPackages.map((p) => p.id)

const legacyPackageMap = new Map<string, string>()
for (const pkg of awardPackages) {
  if (pkg.cupId === 'none') {
    legacyPackageMap.set(`${pkg.medalId}_${pkg.beltId}`, pkg.id)
  }
}

export function normalizeAwardPackageId(id: string): string {
  const withLegacyCups = id.replace(/_standard_fourPlus(?=_|$)/g, '_fourPlus')
  if (awardPackages.some((p) => p.id === withLegacyCups)) return withLegacyCups
  if (awardPackages.some((p) => p.id === id)) return id
  return legacyPackageMap.get(withLegacyCups) ?? legacyPackageMap.get(id) ?? withLegacyCups
}

export function getAwardPackageById(id: string): AwardPackage | undefined {
  const normalized = normalizeAwardPackageId(id)
  return awardPackages.find((p) => p.id === normalized)
}
