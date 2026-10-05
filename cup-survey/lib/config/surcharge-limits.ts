import { BASE_ENTRY_FEE } from './pricing'
import { awardPackages } from './award-packages'
import { venues } from './venues'

const maxVenueSurcharge = Math.max(...venues.map((v) => v.surcharge))
const maxPackageSurcharge = Math.max(...awardPackages.map((p) => p.surcharge))

/** Ориентир максимального стартового взноса (база + площадка + награды). */
export const MAX_POSSIBLE_ENTRY_FEE = BASE_ENTRY_FEE + maxVenueSurcharge + maxPackageSurcharge
