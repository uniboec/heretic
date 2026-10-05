import { InvalidScheduleReorderError } from './errors'
import type { InternalBout } from './types'

function stageBlocks(
  boutIds: string[],
  boutById: Map<string, InternalBout>,
): number[] {
  const blocks: number[] = []
  for (const id of boutIds) {
    const bout = boutById.get(id)
    if (!bout) continue
    const stage = bout.competitionStage
    if (blocks.length === 0 || blocks[blocks.length - 1] !== stage) {
      blocks.push(stage)
    }
  }
  return blocks
}

function groupIdsByStage(
  boutIds: string[],
  boutById: Map<string, InternalBout>,
): Map<number, string[]> {
  const byStage = new Map<number, string[]>()
  for (const id of boutIds) {
    const bout = boutById.get(id)
    if (!bout) continue
    const list = byStage.get(bout.competitionStage) ?? []
    list.push(id)
    byStage.set(bout.competitionStage, list)
  }
  return byStage
}

export function assertSameStageManualReorder(
  orderedBoutIds: string[],
  bouts: InternalBout[],
): void {
  const boutById = new Map(bouts.map((bout) => [bout.id, bout]))
  const originalIds = bouts.map((bout) => bout.id)

  const originalBlocks = stageBlocks(originalIds, boutById)
  const nextBlocks = stageBlocks(orderedBoutIds, boutById)
  if (
    originalBlocks.length !== nextBlocks.length ||
    originalBlocks.some((stage, index) => stage !== nextBlocks[index])
  ) {
    throw new InvalidScheduleReorderError(
      'Порядок можно менять только внутри одного этапа',
    )
  }

  const originalByStage = groupIdsByStage(originalIds, boutById)
  const nextByStage = groupIdsByStage(orderedBoutIds, boutById)
  for (const [stage, ids] of originalByStage) {
    const nextIds = nextByStage.get(stage) ?? []
    if (ids.length !== nextIds.length) {
      throw new InvalidScheduleReorderError(
        'Порядок можно менять только внутри одного этапа',
      )
    }
    const nextIdSet = new Set(nextIds)
    if (!ids.every((id) => nextIdSet.has(id))) {
      throw new InvalidScheduleReorderError(
        'Порядок можно менять только внутри одного этапа',
      )
    }
  }
}
