import type { BracketSystem } from '../../../core/types'
import {
  buildThreeWayV1,
  supportedThreeWayBronzeModes,
  validateThreeWayCategory,
} from './build'

export const threeWayV1: BracketSystem = {
  id: 'three_way',
  version: 1,
  label: 'Тройка с возвратом',
  requiresFreshSeeding: true,
  supportsBouts: true,
  maxParticipants: 3,
  build: buildThreeWayV1,
  validateCategory: (n, _options) => validateThreeWayCategory(n),
  supportedBronzeModes: supportedThreeWayBronzeModes,
}
