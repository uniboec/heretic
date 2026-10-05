import { parseFilenameFromContentDisposition as parseFromContentDisposition } from '@/lib/brackets/export/filename'

export function parseFilenameFromContentDisposition(header: string | null): string | null {
  return parseFromContentDisposition(header)
}

export function defaultBracketWordExportFilename(categoryKey?: string | null): string {
  if (categoryKey) return `setka-${categoryKey}.docx`
  return 'setki-sudyam.docx'
}

export async function downloadBracketWordExport(input: {
  categoryKey?: string | null
  buildUrl: (categoryKey?: string | null) => string
  defaultFilename?: (categoryKey?: string | null) => string
  onStart?: () => void
  onDone?: () => void
  onError?: (message: string) => void
}): Promise<void> {
  input.onStart?.()
  try {
    const res = await fetch(input.buildUrl(input.categoryKey), { credentials: 'include' })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string; categoryKey?: string } | null
      const message =
        body?.error ??
        (body?.categoryKey ? `Ошибка категории ${body.categoryKey}` : undefined) ??
        'Не удалось сформировать документ'
      input.onError?.(message)
      return
    }
    const blob = await res.blob()
    const filename =
      parseFilenameFromContentDisposition(res.headers.get('Content-Disposition')) ??
      input.defaultFilename?.(input.categoryKey) ??
      defaultBracketWordExportFilename(input.categoryKey)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  } finally {
    input.onDone?.()
  }
}
