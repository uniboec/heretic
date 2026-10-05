'use client'

import {
  expandBracketSectionForExport,
  measureBracketSectionSize,
} from './expandBracketSectionForExport'
import {
  copyThemeVariablesToClone,
  inlineComputedStylesFromSourceTree,
  removeDocumentStylesheets,
} from './sanitizeHtml2CanvasDocument'

export const BRACKET_EXPORT_CAPTURE_CLASS = 'bracket-export-capture'

function prepareBracketExportClone(root: HTMLElement, source: HTMLElement): void {
  root.classList.add(BRACKET_EXPORT_CAPTURE_CLASS)
  root.style.position = 'fixed'
  root.style.left = '0'
  root.style.top = '0'
  root.style.margin = '0'
  root.style.transform = 'none'
  root.style.width = 'max-content'
  root.style.maxWidth = 'none'
  root.style.overflow = 'visible'
  root.style.zIndex = '-1'
  root.style.background = '#ffffff'

  root.querySelectorAll('.admin-brackets-print-target > .p-3').forEach((node) => {
    const element = node as HTMLElement
    element.style.overflow = 'visible'
    element.style.maxWidth = 'none'
    element.style.width = 'max-content'
  })

  root.querySelectorAll('.bracket-tree__scroll, .bracket-system-viewport').forEach((node) => {
    const element = node as HTMLElement
    element.style.overflow = 'visible'
    element.style.width = `${Math.max(element.scrollWidth, element.clientWidth)}px`
    element.style.maxWidth = 'none'
  })

  root.querySelectorAll('.bracket-tree__rounds, .bracket-bout-list').forEach((node) => {
    const element = node as HTMLElement
    element.style.width = 'max-content'
    element.style.maxWidth = 'none'
  })

  root.querySelectorAll('.bracket-tree__scroll-hint, .bracket-system-viewport__hint').forEach((node) => {
    ;(node as HTMLElement).style.display = 'none'
  })

  root.querySelectorAll('.bracket-export-ignore').forEach((node) => {
    ;(node as HTMLElement).style.display = 'none'
  })

  root.querySelectorAll('.admin-brackets-print-header').forEach((node) => {
    ;(node as HTMLElement).style.display = 'block'
  })

  const contentWidth = Math.max(root.scrollWidth, root.offsetWidth, 1)
  const contentHeight = Math.max(root.scrollHeight, root.offsetHeight, 1)
  root.style.width = `${contentWidth}px`
  root.style.height = `${contentHeight}px`

  applyBracketExportPendingLayout(root)
}

function applyBracketExportPendingLayout(root: HTMLElement): void {
  root.querySelectorAll('.bracket-match__export-pending').forEach((node) => {
    const element = node as HTMLElement
    element.style.display = 'flex'
    element.style.flex = '1'
    element.style.flexDirection = 'column'
    element.style.justifyContent = 'center'
    element.style.gap = '0.25rem'
    element.style.minWidth = '0'
    element.style.padding = '0 0.5rem'
  })

  root.querySelectorAll('.bracket-match__pending, .bracket-match__screen-pending').forEach((node) => {
    ;(node as HTMLElement).style.display = 'none'
  })

  root.querySelectorAll('.bracket-bronze__slot--pending').forEach((node) => {
    const element = node as HTMLElement
    element.style.flexDirection = 'column'
    element.style.alignItems = 'stretch'
    element.style.justifyContent = 'center'
    element.style.gap = '0.25rem'
  })
}

export type CaptureBracketElementOptions = {
  scale?: number
}

export type CapturedBracketImage = {
  png: Uint8Array
  width: number
  height: number
}

export async function captureBracketElement(
  element: HTMLElement,
  options?: CaptureBracketElementOptions,
): Promise<CapturedBracketImage> {
  const html2canvas = (await import('html2canvas-pro')).default
  const scale = options?.scale ?? 2
  const cleanupLayout = expandBracketSectionForExport(element)

  try {
    const canvas = await html2canvas(element, {
      scale,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      onclone: (document, cloned) => {
        removeDocumentStylesheets(document)
        copyThemeVariablesToClone(document, window)
        document.documentElement.style.backgroundColor = '#ffffff'
        if (document.body) {
          document.body.style.backgroundColor = '#ffffff'
        }
        prepareBracketExportClone(cloned, element)
        expandBracketSectionForExport(cloned)
        inlineComputedStylesFromSourceTree(cloned, element, window)
        const measured = measureBracketSectionSize(cloned)
        cloned.style.width = `${measured.width}px`
        cloned.style.height = `${measured.height}px`
      },
    })

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) resolve(value)
        else reject(new Error('Не удалось сформировать изображение сетки'))
      }, 'image/png')
    })

    const png = new Uint8Array(await blob.arrayBuffer())
    return {
      png,
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    cleanupLayout()
  }
}
