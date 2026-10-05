import type { CorrectionImpactAdapter } from './types'
import { olympicCorrectionAdapter } from './olympicAdapter'
import { roundRobinCorrectionAdapter } from './roundRobinAdapter'

const ADAPTERS: Record<string, CorrectionImpactAdapter> = {
  olympic: olympicCorrectionAdapter,
  round_robin: roundRobinCorrectionAdapter,
  three_way: olympicCorrectionAdapter,
  'three-way': olympicCorrectionAdapter,
  champion: {
    systemId: 'champion',
    preview(ctx) {
      return {
        correctionMode: 'METADATA_ONLY',
        affectedBoutIds: [ctx.sourceBoutId],
        invalidatedBoutIds: [],
      }
    },
    apply(ctx) {
      return { affectedBoutIds: [ctx.sourceBoutId], invalidatedBoutIds: [] }
    },
  },
}

export function getCorrectionImpactAdapter(systemId: string): CorrectionImpactAdapter {
  const adapter = ADAPTERS[systemId]
  if (!adapter) {
    throw new Error(`Unsupported correction adapter for systemId: ${systemId}`)
  }
  return adapter
}

export type { CorrectionImpactContext, CorrectionImpactPreview } from './types'
