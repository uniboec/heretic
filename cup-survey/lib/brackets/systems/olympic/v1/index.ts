import type { BracketSystem } from '../../../core/types'
import { buildOlympicV1, olympicSupportedBronzeModes, validateOlympicCategory } from './build'

export const olympicV1: BracketSystem = {
  id: 'olympic',
  version: 1,
  label: 'Олимпийская',
  requiresFreshSeeding: true,
  supportsBouts: true,
  maxParticipants: 32,
  build: buildOlympicV1,
  validateCategory: validateOlympicCategory,
  supportedBronzeModes: (n) => {
    const modes = olympicSupportedBronzeModes(n)
    return modes ? [...modes] : null
  },
}
