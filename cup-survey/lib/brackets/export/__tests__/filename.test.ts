import { describe, expect, it } from 'vitest'
import {
  buildBulkExportFilename,
  buildContentDisposition,
  buildSingleCategoryExportFilename,
  parseFilenameFromContentDisposition,
  sanitizeFilenamePart,
} from '../filename'

describe('filename helpers', () => {
  it('sanitizes unsafe characters', () => {
    expect(sanitizeFilenamePart('Мужчины 70+ / A')).toBe('Мужчины-70+-A')
  })

  it('builds single category filename', () => {
    expect(buildSingleCategoryExportFilename('Юноши 12-13')).toMatch(/^setka-.*\.docx$/)
  })

  it('builds bulk filename with date', () => {
    expect(buildBulkExportFilename('2026-10-02')).toBe('setki-sudyam-2026-10-02.docx')
  })

  it('roundtrips content disposition filename', () => {
    const header = buildContentDisposition('setki-sudyam-2026-10-02.docx')
    expect(parseFilenameFromContentDisposition(header)).toBe('setki-sudyam-2026-10-02.docx')
  })
})
