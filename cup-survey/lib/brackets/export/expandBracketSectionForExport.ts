export const BRACKET_SCROLL_SELECTORS =
  '.bracket-system-viewport-wrap, .bracket-tree__scroll, .bracket-system-viewport'

export const BRACKET_CONTENT_SELECTORS =
  '.bracket-tree__rounds, .bracket-olympic, .bracket-bout-list, .bracket-three-way, .bracket-rr'

type NodeStyleSnapshot = {
  overflow: string
  width: string
  maxWidth: string
  minWidth: string
}

function snapshotNodeStyles(element: HTMLElement): NodeStyleSnapshot {
  return {
    overflow: element.style.overflow,
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    minWidth: element.style.minWidth,
  }
}

function restoreNodeStyles(element: HTMLElement, snapshot: NodeStyleSnapshot): void {
  element.style.overflow = snapshot.overflow
  element.style.width = snapshot.width
  element.style.maxWidth = snapshot.maxWidth
  element.style.minWidth = snapshot.minWidth
}

function getBracketContentRoot(section: HTMLElement): HTMLElement | null {
  return section.querySelector(BRACKET_CONTENT_SELECTORS)
}

function measureBracketContentWidth(section: HTMLElement): number {
  const widths: number[] = []

  const bracketRoot = getBracketContentRoot(section)
  if (bracketRoot) {
    widths.push(bracketRoot.scrollWidth, bracketRoot.offsetWidth, bracketRoot.clientWidth)
  }

  for (const node of section.querySelectorAll(
    `${BRACKET_CONTENT_SELECTORS}, .bracket-tree, .bracket-bronze`,
  )) {
    const element = node as HTMLElement
    widths.push(element.scrollWidth, element.offsetWidth, element.clientWidth)
  }

  return widths.length > 0 ? Math.max(...widths) : 0
}

export function measureBracketSectionSize(section: HTMLElement): { width: number; height: number } {
  return {
    width: Math.max(section.scrollWidth, section.offsetWidth, section.clientWidth, 1),
    height: Math.max(section.scrollHeight, section.offsetHeight, section.clientHeight, 1),
  }
}

export function expandBracketSectionForExport(section: HTMLElement): () => void {
  const snapshots: Array<{ element: HTMLElement; snapshot: NodeStyleSnapshot }> = []

  const expandNode = (element: HTMLElement, styles: Partial<NodeStyleSnapshot>): void => {
    snapshots.push({ element, snapshot: snapshotNodeStyles(element) })
    if (styles.overflow !== undefined) element.style.overflow = styles.overflow
    if (styles.width !== undefined) element.style.width = styles.width
    if (styles.maxWidth !== undefined) element.style.maxWidth = styles.maxWidth
    if (styles.minWidth !== undefined) element.style.minWidth = styles.minWidth
  }

  expandNode(section, {
    overflow: 'visible',
    maxWidth: 'none',
    minWidth: '0',
    width: 'max-content',
  })

  section.querySelectorAll('.admin-brackets-print-target > .p-3').forEach((node) => {
    expandNode(node as HTMLElement, {
      overflow: 'visible',
      maxWidth: 'none',
      minWidth: '0',
      width: 'max-content',
    })
  })

  section.querySelectorAll(BRACKET_CONTENT_SELECTORS).forEach((node) => {
    expandNode(node as HTMLElement, {
      overflow: 'visible',
      maxWidth: 'none',
      minWidth: '0',
      width: 'max-content',
    })
  })

  const bracketWidth = measureBracketContentWidth(section)

  section.querySelectorAll(BRACKET_SCROLL_SELECTORS).forEach((node) => {
    expandNode(node as HTMLElement, {
      overflow: 'visible',
      maxWidth: 'none',
      minWidth: '0',
      width: bracketWidth > 0 ? `${bracketWidth}px` : 'max-content',
    })
  })

  void section.offsetHeight

  return () => {
    for (const { element, snapshot } of snapshots) {
      restoreNodeStyles(element, snapshot)
    }
  }
}
