import 'server-only'

import { PDFDocument, PageSizes } from 'pdf-lib'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import type { BracketExportCategory } from './types'
import { BracketExportRenderError } from './errors'
import { renderCategoryPrintImages } from './renderCategoryPrintImages'
import { rasterizeSvg } from '../print/rasterizeSvg'

export type BuildBracketPdfDocumentOptions = {
  includeTitlePage?: boolean
}

function formatGeneratedAt(now: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(now)
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function drawTitlePage(pdf: PDFDocument, generatedAt: Date): Promise<void> {
  const lines: Array<{ text: string; size: number; bold?: boolean }> = [
    { text: tournamentInfo.title, size: 20, bold: true },
    { text: tournamentInfo.subtitle, size: 12 },
    { text: `${tournamentInfo.eventDateLabel}, ${tournamentInfo.venue.city}`, size: 12 },
    { text: 'Сетки для судей за столом', size: 14, bold: true },
    { text: `Сформировано: ${formatGeneratedAt(generatedAt)}`, size: 11 },
  ]

  const svgLines = lines
    .map((line, index) => {
      const y = 120 + index * 36
      return `<text x="56" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${line.size}" font-weight="${line.bold ? 700 : 400}" fill="#111111">${escapeXml(line.text)}</text>`
    })
    .join('\n')

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  ${svgLines}
</svg>`

  const png = await rasterizeSvg(svg, 595, 842)
  const page = pdf.addPage(PageSizes.A4)
  const image = await pdf.embedPng(png)
  const { width, height } = page.getSize()
  page.drawImage(image, { x: 0, y: 0, width, height })
}

async function appendCategoryImages(
  pdf: PDFDocument,
  category: BracketExportCategory,
): Promise<void> {
  const images = await renderCategoryPrintImages(category)

  for (const image of images) {
    const pageSize =
      image.orientation === 'landscape'
        ? ([PageSizes.A4[1], PageSizes.A4[0]] as [number, number])
        : PageSizes.A4
    const page = pdf.addPage(pageSize)
    const pngImage = await pdf.embedPng(image.png)
    const { width, height } = page.getSize()
    const margin = 28
    const availableWidth = width - margin * 2
    const availableHeight = height - margin * 2
    const aspect = image.viewBoxHeight / image.viewBoxWidth

    let drawWidth = availableWidth
    let drawHeight = drawWidth * aspect
    if (drawHeight > availableHeight) {
      drawHeight = availableHeight
      drawWidth = drawHeight / aspect
    }

    page.drawImage(pngImage, {
      x: margin + (availableWidth - drawWidth) / 2,
      y: margin + (availableHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    })
  }
}

export async function buildBracketPdfDocument(
  categories: BracketExportCategory[],
  options?: BuildBracketPdfDocumentOptions,
): Promise<Uint8Array> {
  if (categories.length === 0) {
    throw new BracketExportRenderError('Нет категорий для экспорта')
  }

  const pdf = await PDFDocument.create()
  const generatedAt = new Date()

  if (options?.includeTitlePage) {
    await drawTitlePage(pdf, generatedAt)
  }

  for (const category of categories) {
    try {
      await appendCategoryImages(pdf, category)
    } catch (error) {
      if (error instanceof BracketExportRenderError) throw error
      const message = error instanceof Error ? error.message : 'Ошибка рендеринга'
      throw new BracketExportRenderError(message, category.categoryKey)
    }
  }

  return pdf.save()
}
