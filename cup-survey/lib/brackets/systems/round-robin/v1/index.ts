import type { BracketSystem } from '../../../core/types'
import { buildRoundRobinV1, validateRoundRobinCategory } from './build'

export const roundRobinV1: BracketSystem = {
  id: 'round_robin',
  version: 1,
  label: 'Круговая',
  requiresFreshSeeding: false,
  supportsBouts: true,
  maxParticipants: 32,
  build: buildRoundRobinV1,
  validateCategory: (n) => validateRoundRobinCategory(n),
  supportedBronzeModes: () => null,
}
