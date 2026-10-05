import type { InternalBout } from './types'

function isPlayableSide(side: InternalBout['sideA']): boolean {
  return side.kind === 'athlete' || side.kind === 'hint'
}

export function toPlayableBouts(bouts: InternalBout[], participantCount: number): InternalBout[] {
  if (participantCount < 2) return []
  return bouts.filter((bout) => isPlayableSide(bout.sideA) && isPlayableSide(bout.sideB))
}
