'use client'

import {
  expandBracketSectionForExport,
  measureBracketSectionSize,
} from './expandBracketSectionForExport'
import { getPrintablePageSize } from './printPageMetrics'

type PageStyleSnapshot = {
  width: string
  height: string
  minHeight: string
  maxHeight: string
  overflow: string
  display: string
  flexDirection: string
  alignItems: string
  justifyContent: string
  printOrientation: string | null
}

type SectionStyleSnapshot = {
  width: string
  height: string
  minHeight: string
  maxWidth: string
  overflow: string
  zoom: string
  printOrientation: string | null
  page?: {
    element: HTMLElement
    snapshot: PageStyleSnapshot
  }
  cleanupExport?: () => void
}

function snapshotSectionStyles(section: HTMLElement): SectionStyleSnapshot {
  return {
    width: section.style.width,
    height: section.style.height,
    minHeight: section.style.minHeight,
    maxWidth: section.style.maxWidth,
    overflow: section.style.overflow,
    zoom: section.style.zoom,
    printOrientation: section.getAttribute('data-print-orientation'),
  }
}

function restoreSectionStyles(section: HTMLElement, snapshot: SectionStyleSnapshot): void {
  section.style.width = snapshot.width
  section.style.height = snapshot.height
  section.style.minHeight = snapshot.minHeight
  section.style.maxWidth = snapshot.maxWidth
  section.style.overflow = snapshot.overflow
  section.style.zoom = snapshot.zoom

  if (snapshot.printOrientation) {
    section.setAttribute('data-print-orientation', snapshot.printOrientation)
  } else {
    section.removeAttribute('data-print-orientation')
  }

  snapshot.cleanupExport?.()

  if (snapshot.page) {
    const { element, snapshot: pageSnapshot } = snapshot.page
    element.style.width = pageSnapshot.width
    element.style.height = pageSnapshot.height
    element.style.minHeight = pageSnapshot.minHeight
    element.style.maxHeight = pageSnapshot.maxHeight
    element.style.overflow = pageSnapshot.overflow
    element.style.display = pageSnapshot.display
    element.style.flexDirection = pageSnapshot.flexDirection
    element.style.alignItems = pageSnapshot.alignItems
    element.style.justifyContent = pageSnapshot.justifyContent
    if (pageSnapshot.printOrientation) {
      element.setAttribute('data-print-orientation', pageSnapshot.printOrientation)
    } else {
      element.removeAttribute('data-print-orientation')
    }
  }
}

export function prepareAdminBracketBulkPrint(sections: HTMLElement[]): () => void {
  const snapshots = new Map<HTMLElement, SectionStyleSnapshot>()

  for (const section of sections) {
    const snapshot = snapshotSectionStyles(section)
    snapshot.cleanupExport = expandBracketSectionForExport(section)

    const { width: naturalWidth, height: naturalHeight } = measureBracketSectionSize(section)
    const landscape = naturalWidth > naturalHeight * 1.05
    const printable = getPrintablePageSize(landscape)
    const scale = Math.min(
      printable.width / naturalWidth,
      printable.height / naturalHeight,
      1,
    )

    const pageElement = section.closest('.admin-brackets-print-all__page') as HTMLElement | null
    if (pageElement) {
      snapshot.page = {
        element: pageElement,
        snapshot: {
          width: pageElement.style.width,
          height: pageElement.style.height,
          minHeight: pageElement.style.minHeight,
          maxHeight: pageElement.style.maxHeight,
          overflow: pageElement.style.overflow,
          display: pageElement.style.display,
          flexDirection: pageElement.style.flexDirection,
          alignItems: pageElement.style.alignItems,
          justifyContent: pageElement.style.justifyContent,
          printOrientation: pageElement.getAttribute('data-print-orientation'),
        },
      }
      pageElement.setAttribute('data-print-orientation', landscape ? 'landscape' : 'portrait')
      pageElement.style.overflow = 'hidden'
      pageElement.style.display = 'flex'
      pageElement.style.flexDirection = 'column'
      pageElement.style.alignItems = 'center'
      pageElement.style.justifyContent = 'center'
      pageElement.style.width = `${printable.width}px`
      pageElement.style.height = `${printable.height}px`
      pageElement.style.minHeight = '0'
      pageElement.style.maxHeight = `${printable.height}px`
    }

    section.setAttribute('data-print-orientation', landscape ? 'landscape' : 'portrait')
    section.style.width = `${naturalWidth}px`
    section.style.maxWidth = 'none'
    section.style.overflow = 'visible'
    section.style.minHeight = '0'
    section.style.height = `${naturalHeight}px`
    section.style.zoom = scale < 0.999 ? String(scale) : ''

    snapshots.set(section, snapshot)
  }

  return () => {
    for (const [section, snapshot] of snapshots) {
      restoreSectionStyles(section, snapshot)
    }
  }
}

export async function printAdminBracketBulkSections(sections: HTMLElement[]): Promise<void> {
  if (sections.length === 0) {
    throw new Error('Не удалось подготовить сетки для печати')
  }

  const cleanupLayout = prepareAdminBracketBulkPrint(sections)

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(fallbackTimer)
      cleanupLayout()
      window.removeEventListener('afterprint', finish)
      resolve()
    }

    const fallbackTimer = window.setTimeout(finish, 60_000)
    window.addEventListener('afterprint', finish)
    window.print()
  })
}
