import {
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  WidthType,
  BorderStyle,
  VerticalAlign,
  AlignmentType,
  PageBreak,
} from 'docx'
import type { BoutPaperBlockLines } from './formatBoutPaperBlock'
import { DOCX_FONT_BODY, DOCX_FONT_META } from './docxTheme'

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
}

export function textParagraph(
  text: string,
  options?: { bold?: boolean; size?: number; spacingAfter?: number },
): Paragraph {
  return new Paragraph({
    spacing: { after: options?.spacingAfter ?? 120 },
    children: [
      new TextRun({
        text,
        bold: options?.bold,
        size: options?.size ?? DOCX_FONT_BODY,
        font: 'Calibri',
      }),
    ],
  })
}

export function centeredBracketImageParagraph(
  png: Uint8Array | Buffer,
  size: { width: number; height: number },
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        type: 'png',
        data: png,
        transformation: { width: size.width, height: size.height },
      }),
    ],
  })
}

export function boutPaperBlockParagraphs(block: BoutPaperBlockLines): Paragraph[] {
  const lines: Paragraph[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: block.boutLabel, bold: true, size: DOCX_FONT_BODY, font: 'Calibri' })],
    }),
  ]

  for (const line of block.participantLines) {
    lines.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: line, size: DOCX_FONT_BODY, font: 'Calibri' })],
      }),
    )
  }

  lines.push(
    new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [new TextRun({ text: block.resultLine, size: DOCX_FONT_META, font: 'Calibri' })],
    }),
  )

  if (block.winnerLine) {
    lines.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: block.winnerLine, size: DOCX_FONT_META, font: 'Calibri' })],
      }),
    )
  }

  return lines
}

export function boutPaperBlockCell(block: BoutPaperBlockLines): TableCell {
  return new TableCell({
    borders: TABLE_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: boutPaperBlockParagraphs(block),
  })
}

export function emptyTableCell(): TableCell {
  return new TableCell({
    borders: TABLE_BORDERS,
    children: [new Paragraph({ children: [] })],
  })
}

export function labeledTable(headers: string[], rows: TableRow[]): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (header) =>
        new TableCell({
          borders: TABLE_BORDERS,
          shading: { fill: 'F3F4F6' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: header, bold: true, size: DOCX_FONT_META, font: 'Calibri' })],
            }),
          ],
        }),
    ),
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...rows],
  })
}

export function pageBreakParagraph(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] })
}

export { TABLE_BORDERS }
