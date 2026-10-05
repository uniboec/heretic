'use client'

import { tournamentInfo, TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import {
  buildBulkExportFilename,
  buildSingleCategoryExportFilename,
} from './filename'
import { captureBracketElement } from './captureBracketDom'
import { buildBracketWordFromCaptures } from './buildBracketWordFromCaptures'
import { waitForBracketLayout } from './waitForBracketLayout'
import { PRINT_PAGE_MARGIN_PX } from './printPageMetrics'

function formatGeneratedAt(now: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(now)
}

function bulkFilenameDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TOURNAMENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function captureTitlePageElement(): Promise<{
  png: Uint8Array
  width: number
  height: number
}> {
  const wrapper = document.createElement('div')
  wrapper.className = 'bracket-export-title-page'
  wrapper.innerHTML = `
    <div class="bracket-export-title-page__inner">
      <h1>${tournamentInfo.title}</h1>
      <p>${tournamentInfo.subtitle}</p>
      <p>${tournamentInfo.eventDateLabel}, ${tournamentInfo.venue.city}</p>
      <p class="bracket-export-title-page__lead">Сетки для судей за столом</p>
      <p class="bracket-export-title-page__meta">Сформировано: ${formatGeneratedAt(new Date())}</p>
    </div>
  `
  wrapper.style.position = 'fixed'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.width = '794px'
  wrapper.style.background = '#ffffff'
  wrapper.style.padding = '56px'
  wrapper.style.zIndex = '-1'
  document.body.appendChild(wrapper)

  try {
    await waitForBracketLayout()
    return await captureBracketElement(wrapper, { scale: 2 })
  } finally {
    wrapper.remove()
  }
}

function resolveOrientation(width: number, height: number): 'portrait' | 'landscape' {
  return width > height ? 'landscape' : 'portrait'
}

async function buildPdfFromCaptures(
  captures: Array<{ png: Uint8Array; width: number; height: number }>,
  options?: { includeTitlePage?: boolean },
): Promise<Uint8Array> {
  const { PDFDocument, PageSizes } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const pages = options?.includeTitlePage
    ? [await captureTitlePageElement(), ...captures]
    : captures

  for (const capture of pages) {
    const image = await pdf.embedPng(capture.png)
    const width = capture.width
    const height = capture.height
    const isLandscape = width > height
    const page = pdf.addPage(isLandscape ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const margin = PRINT_PAGE_MARGIN_PX
    const availableWidth = pageWidth - margin * 2
    const availableHeight = pageHeight - margin * 2
    const aspect = height / width

    let drawWidth = availableWidth
    let drawHeight = drawWidth * aspect
    if (drawHeight > availableHeight) {
      drawHeight = availableHeight
      drawWidth = drawHeight / aspect
    }

    page.drawImage(image, {
      x: margin + (availableWidth - drawWidth) / 2,
      y: margin + (availableHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
  }

  return pdf.save()
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export type BracketDomExportSection = {
  element: HTMLElement
  title: string
  meta: string
}

async function captureSections(sections: BracketDomExportSection[]) {
  await waitForBracketLayout()
  return Promise.all(
    sections.map(async (section) => {
      const capture = await captureBracketElement(section.element, { scale: 2 })
      return {
        section,
        capture,
      }
    }),
  )
}

export async function exportBracketSectionsToPdf(
  sections: BracketDomExportSection[],
  options?: {
    includeTitlePage?: boolean
    filename?: string
  },
): Promise<void> {
  if (sections.length === 0) {
    throw new Error('Нет сеток для экспорта')
  }

  const captured = await captureSections(sections)
  const pdfBytes = await buildPdfFromCaptures(
    captured.map((entry) => entry.capture),
    { includeTitlePage: options?.includeTitlePage },
  )
  const filename = options?.filename ?? buildBulkExportFilename(bulkFilenameDate(), 'pdf')
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), filename)
}

export async function exportBracketSectionsToWord(
  sections: BracketDomExportSection[],
  options?: {
    includeTitlePage?: boolean
    filename?: string
    categoryKey?: string | null
  },
): Promise<void> {
  if (sections.length === 0) {
    throw new Error('Нет сеток для экспорта')
  }

  const captured = await captureSections(sections)
  const blob = await buildBracketWordFromCaptures(
    captured.map(({ section, capture }) => ({
      title: section.title,
      meta: section.meta,
      orientation: resolveOrientation(capture.width, capture.height),
      png: capture.png,
      width: capture.width,
      height: capture.height,
    })),
    { includeTitlePage: options?.includeTitlePage },
  )

  const filename =
    options?.filename ??
    (options?.categoryKey
      ? buildSingleCategoryExportFilename(sections[0]!.title)
      : buildBulkExportFilename(bulkFilenameDate()))

  downloadBlob(blob, filename)
}

export async function exportBracketElementToPdf(
  element: HTMLElement,
  options: {
    title: string
    meta: string
    filename: string
    includeTitlePage?: boolean
  },
): Promise<void> {
  await exportBracketSectionsToPdf(
    [{ element, title: options.title, meta: options.meta }],
    { includeTitlePage: options.includeTitlePage, filename: options.filename },
  )
}

export async function exportBracketElementToWord(
  element: HTMLElement,
  options: {
    title: string
    meta: string
    filename: string
    includeTitlePage?: boolean
    categoryKey?: string | null
  },
): Promise<void> {
  await exportBracketSectionsToWord(
    [{ element, title: options.title, meta: options.meta }],
    {
      includeTitlePage: options.includeTitlePage,
      filename: options.filename,
      categoryKey: options.categoryKey,
    },
  )
}
