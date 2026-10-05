import type { PrintModel, PrintPage } from './types'

/** Returns pages from model (anchors assigned during layout build). */
export function splitPrintPages(model: PrintModel): PrintPage[] {
  return model.pages
}

export function assignCrossPageAnchors(pages: PrintPage[]): PrintPage[] {
  if (pages.length <= 1) return pages

  return pages.map((page, index) => {
    const chrome = { ...page.chrome }
    if (index < pages.length - 1) {
      const label = `A${index + 1}`
      chrome.outgoingAnchors = [
        {
          label,
          slot: { kind: 'BLANK_ADVANCE', sourceBoutId: `anchor-${label}`, sourceOutcome: 'WINNER' },
          x: page.viewBoxWidth - 180,
          y: page.viewBoxHeight - 40,
          side: 'right',
        },
      ]
    }
    if (index > 0) {
      const label = `A${index}`
      chrome.incomingAnchors = [
        {
          label,
          slot: { kind: 'BLANK_ADVANCE', sourceBoutId: `anchor-${label}`, sourceOutcome: 'WINNER' },
          x: 40,
          y: 100,
          side: 'left',
        },
      ]
    }
    return { ...page, chrome }
  })
}
