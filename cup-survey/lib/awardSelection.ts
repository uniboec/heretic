import { awardPackages, normalizeAwardPackageId, type AwardPackage } from './config/award-packages'
import {
  compositionNeedsBelts,
  compositionNeedsCups,
  type PrizeCompositionId,
} from './config/prize-compositions'

export interface AwardSelectionInput {
  acceptableMedals: string[]
  acceptablePrizeCompositions: string[]
  acceptableBelts: string[]
  acceptableCups: string[]
}

export function filterAwardPackages(input: AwardSelectionInput): AwardPackage[] {
  const compositions = new Set(input.acceptablePrizeCompositions)
  const needsBelts = compositionNeedsBelts(input.acceptablePrizeCompositions)
  const needsCups = compositionNeedsCups(input.acceptablePrizeCompositions)

    return awardPackages.filter((pkg) => {
    if (!input.acceptableMedals.includes(pkg.medalId)) return false
    if (!compositions.has(pkg.compositionId)) return false

    if (needsBelts) {
      if (pkg.beltId !== 'none') {
        if (!input.acceptableBelts.includes(pkg.beltId)) return false
      } else if (compositionNeedsBelts([pkg.compositionId])) {
        return false
      }
    } else if (pkg.beltId !== 'none') {
      return false
    }

    if (needsCups) {
      if (pkg.cupId !== 'none') {
        if (!input.acceptableCups.includes(pkg.cupId)) return false
      } else if (compositionNeedsCups([pkg.compositionId])) {
        return false
      }
    } else if (pkg.cupId !== 'none') {
      return false
    }

    return true
  })
}

export function deriveAwardPackageIds(input: AwardSelectionInput): string[] {
  return filterAwardPackages(input).map((pkg) => pkg.id)
}

export function pruneAwardPackages(
  packageIds: string[],
  input: AwardSelectionInput,
): string[] {
  const allowed = new Set(filterAwardPackages(input).map((p) => p.id))
  return packageIds
    .map((id) => normalizeAwardPackageId(id))
    .filter((id) => allowed.has(id))
}

export function packageMatchesComposition(
  pkg: AwardPackage,
  compositionId: PrizeCompositionId,
): boolean {
  return pkg.compositionId === compositionId
}
