import type { BracketSystem } from '../../../core/types'
import { buildChampionV1, validateChampionCategory } from './build'

export const championV1: BracketSystem = {
  id: 'champion',
  version: 1,
  label: 'Чемпион',
  requiresFreshSeeding: false,
  supportsBouts: false,
  maxParticipants: 1,
  build: buildChampionV1,
  validateCategory: (n) => validateChampionCategory(n),
  supportedBronzeModes: () => null,
}
