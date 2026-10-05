import {
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  SectionType,
  TextRun,
  convertMillimetersToTwip,
} from 'docx'
import { tournamentInfo, TOURNAMENT_TIMEZONE } from '@/lib/config/tournament'
import { DOCX_FONT_BODY, DOCX_FONT_TITLE, DOCX_PAGE_MARGINS } from './docxTheme'
import { centeredBracketImageParagraph, textParagraph } from './docxNodes'
import { PRINTABLE_DOCX } from '../print/layoutEngine/metrics'

export type BracketWordCaptureSection = {
  title: string
  meta: string
  orientation: 'portrait' | 'landscape'
  png: Uint8Array
  width: number
  height: number
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

function buildCategorySectionChildren(section: BracketWordCaptureSection): Paragraph[] {
  const aspect = section.height / section.width
  const printable = PRINTABLE_DOCX[section.orientation]
  let displayWidth = printable.width
  let displayHeight = Math.round(displayWidth * aspect)
  if (displayHeight > printable.height) {
    displayHeight = printable.height
    displayWidth = Math.round(displayHeight / aspect)
  }

  const meta = section.meta.trim()

  return [
    textParagraph(section.title, { bold: true, size: 32, spacingAfter: 80 }),
    ...(meta ? [textParagraph(meta, { spacingAfter: 160 })] : []),
    centeredBracketImageParagraph(section.png, {
      width: displayWidth,
      height: displayHeight,
    }),
  ]
}

export async function buildBracketWordFromCaptures(
  sections: BracketWordCaptureSection[],
  options?: { includeTitlePage?: boolean },
): Promise<Blob> {
  if (sections.length === 0) {
    throw new Error('Нет категорий для экспорта')
  }

  const includeTitlePage = options?.includeTitlePage ?? false
  const generatedAt = new Date()
  const categorySections = sections.map((section) => ({
    orientation: section.orientation,
    children: buildCategorySectionChildren(section),
  }))

  const docSections = includeTitlePage
    ? [
        {
          properties: pageProperties('portrait'),
          children: buildTitleSectionChildren(generatedAt),
        },
        ...categorySections.map((section) => ({
          properties: {
            type: SectionType.NEXT_PAGE,
            ...pageProperties(section.orientation),
          },
          children: section.children,
        })),
      ]
    : categorySections.map((section, index) => ({
        properties: {
          ...(index > 0 ? { type: SectionType.NEXT_PAGE } : {}),
          ...pageProperties(section.orientation),
        },
        children: section.children,
      }))

  const doc = new Document({ sections: docSections })
  return Packer.toBlob(doc)
}
