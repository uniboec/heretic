export type CorrectionImpactContext = {
  sourceBoutId: string
  categoryKey: string
  systemId: string
  previousWinnerEntryId: string | null
  newWinnerEntryId: string | null
  downstreamBoutIds: string[]
}

export type CorrectionImpactPreview = {
  correctionMode: 'METADATA_ONLY' | 'SAFE_CASCADE' | 'BRANCH_RECOVERY'
  affectedBoutIds: string[]
  invalidatedBoutIds: string[]
  warning?: string
}

export interface CorrectionImpactAdapter {
  systemId: string
  preview(ctx: CorrectionImpactContext): CorrectionImpactPreview
  apply(ctx: CorrectionImpactContext): { affectedBoutIds: string[]; invalidatedBoutIds: string[] }
}
