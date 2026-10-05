import { BracketSystemRegistry } from '../core/registry'
import { olympicV1 } from './olympic/v1'
import { roundRobinV1 } from './round-robin/v1'
import { threeWayV1 } from './three-way/v1'
import { championV1 } from './champion/v1'

let registered = false

export function registerBracketSystems(): void {
  if (registered) return
  BracketSystemRegistry.register(championV1)
  BracketSystemRegistry.register(olympicV1)
  BracketSystemRegistry.register(roundRobinV1)
  BracketSystemRegistry.register(threeWayV1)
  registered = true
}

registerBracketSystems()
