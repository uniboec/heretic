import type { CorrectionImpactAdapter, CorrectionImpactContext } from './types'

export const olympicCorrectionAdapter: CorrectionImpactAdapter = {
  systemId: 'olympic',
  preview(ctx) {
    if (ctx.previousWinnerEntryId === ctx.newWinnerEntryId) {
      return {
        correctionMode: 'METADATA_ONLY',
        affectedBoutIds: [ctx.sourceBoutId],
        invalidatedBoutIds: [],
      }
    }
    const hasDownstream = ctx.downstreamBoutIds.length > 0
    return {
      correctionMode: hasDownstream ? 'BRANCH_RECOVERY' : 'SAFE_CASCADE',
      affectedBoutIds: [ctx.sourceBoutId, ...ctx.downstreamBoutIds],
      invalidatedBoutIds: hasDownstream ? ctx.downstreamBoutIds : [],
      warning: hasDownstream
        ? 'Победитель изменён: downstream поединки будут сброшены.'
        : undefined,
    }
  },
  apply(ctx) {
    const preview = this.preview(ctx)
    return {
      affectedBoutIds: preview.affectedBoutIds,
      invalidatedBoutIds: preview.invalidatedBoutIds,
    }
  },
}
