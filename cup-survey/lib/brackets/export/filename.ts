const UNSAFE_FILENAME = /[\\/:*?"<>|]/g

export function sanitizeFilenamePart(value: string): string {
  const trimmed = value.trim().replace(UNSAFE_FILENAME, '-').replace(/\s+/g, '-').replace(/-+/g, '-')
  const ascii = trimmed.replace(/[^\x20-\x7E\u0400-\u04FF-]/g, '')
  return ascii.slice(0, 80) || 'setka'
}

export function buildSingleCategoryExportFilename(
  title: string,
  format: 'docx' | 'pdf' = 'docx',
): string {
  return `setka-${sanitizeFilenamePart(title)}.${format}`
}

export function buildBulkExportFilename(
  dateIso: string,
  format: 'docx' | 'pdf' = 'docx',
): string {
  const day = dateIso.slice(0, 10)
  return `setki-sudyam-${day}.${format}`
}

export function buildContentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

export function parseFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return null
    }
  }
  const plain = header.match(/filename="([^"]+)"/i)
  return plain?.[1] ?? null
}
