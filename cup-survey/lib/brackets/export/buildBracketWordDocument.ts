import 'server-only'

import {
  Document,
  Packer,
  Paragraph,
  SectionType,
  PageOrientation,
  convertMillimetersToTwip,
} from 'docx'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import type { BracketExportCategory } from './types'
import type { BracketPageOrientation } from './types'
import { BracketExportRenderError } from './errors'
import { DOCX_FONT_BODY, DOCX_FONT_TITLE, DOCX_PAGE_MARGINS } from './docxTheme'
import { resolveCategoryPageLayout } from './resolveCategoryPageLayout'
import { renderCategorySectionChildren } from './renderCategoryDocx'
import { TextRun } from 'docx'
import { buildBracketPrintModel } from '../print/buildBracketPrintModel'

export type BuildBracketWordDocumentOptions = {
  includeTitlePage?: boolean
}

function formatGeneratedAt(now: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TOURNAMENT_TIMEZONE,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(now)
}

function buildTitleSectionChildren(generatedAt: Date): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: tournamentInfo.title,
          bold: true,
          size: DOCX_FONT_TITLE,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: tournamentInfo.subtitle,
          size: DOCX_FONT_BODY,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${tournamentInfo.eventDateLabel}, ${tournamentInfo.venue.city}`,
          size: DOCX_FONT_BODY,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'Сетки для судей за столом',
          bold: true,
          size: DOCX_FONT_BODY,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Сформировано: ${formatGeneratedAt(generatedAt)}`,
          size: DOCX_FONT_BODY,
          font: 'Calibri',
        }),
      ],
    }),
  ]
}

function pageProperties(orientation: 'portrait' | 'landscape') {
  const portrait = orientation === 'portrait'
  return {
    page: {
      margin: DOCX_PAGE_MARGINS,
      size: {
        orientation: portrait ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE,
        width: portrait ? convertMillimetersToTwip(210) : convertMillimetersToTwip(297),
        height: portrait ? convertMillimetersToTwip(297) : convertMillimetersToTwip(210),
      },
    },
  }
}

export type ExportDocumentSectionSpec = {
  orientation: BracketPageOrientation
  sectionType?: (typeof SectionType)[keyof typeof SectionType]
}

export function buildExportDocumentSectionSpecs(
  categories: BracketExportCategory[],
  options?: BuildBracketWordDocumentOptions,
): ExportDocumentSectionSpec[] {
  const specs: ExportDocumentSectionSpec[] = []
  if (options?.includeTitlePage) {
    specs.push({ orientation: 'portrait' })
  }
  for (const category of categories) {
    const model = buildBracketPrintModel(category)
    specs.push({
      orientation: model.orientation,
      sectionType: specs.length > 0 ? SectionType.NEXT_PAGE : undefined,
    })
  }
  return specs
}

async function renderAllCategorySections(categories: BracketExportCategory[]) {
  const renderedSections: Array<{
    category: BracketExportCategory
    children: Awaited<ReturnType<typeof renderCategorySectionChildren>>
  }> = []

  for (const category of categories) {
    try {
      const children = await renderCategorySectionChildren(category)
      renderedSections.push({ category, children })
    } catch (error) {
      if (error instanceof BracketExportRenderError) throw error
      const message = error instanceof Error ? error.message : 'Ошибка рендеринга'
      throw new BracketExportRenderError(message, category.categoryKey)
    }
  }

  return renderedSections
}

export async function buildBracketWordDocument(
  categories: BracketExportCategory[],
  options?: BuildBracketWordDocumentOptions,
): Promise<Buffer> {
  if (categories.length === 0) {
    throw new BracketExportRenderError('Нет категорий для экспорта')
  }

  const includeTitlePage = options?.includeTitlePage ?? false
  const generatedAt = new Date()
  const renderedSections = await renderAllCategorySections(categories)

  const categorySections = renderedSections.map(({ category, children }) => ({
    properties: {
      type: SectionType.NEXT_PAGE,
      ...pageProperties(buildBracketPrintModel(category).orientation),
    },
    children,
  }))

  const sections = includeTitlePage
    ? [
        {
          properties: pageProperties('portrait'),
          children: buildTitleSectionChildren(generatedAt),
        },
        ...categorySections,
      ]
    : renderedSections.map(({ category, children }, index) => ({
        properties: {
          ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
          ...pageProperties(buildBracketPrintModel(category).orientation),
        },
        children,
      }))

  const doc = new Document({ sections })
  return Packer.toBuffer(doc)
}
