import type { CorrectionImpactAdapter } from './types'
import { olympicCorrectionAdapter } from './olympicAdapter'

export const roundRobinCorrectionAdapter: CorrectionImpactAdapter = {
  ...olympicCorrectionAdapter,
  systemId: 'round_robin',
}
