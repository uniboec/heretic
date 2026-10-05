import type { ZodError } from 'zod'

const GENERIC_MESSAGE = 'Проверьте введённые данные'

function looksLikeInternalEnglish(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return true
  if (/ожидалось одно из/i.test(trimmed)) return true
  return /^(invalid|expected|required|too small|too big|received)/i.test(trimmed)
}

export function formatZodIssues(error: ZodError): string[] {
  const messages = error.issues
    .map((issue) => issue.message.trim())
    .filter(Boolean)
    .map((message) => (looksLikeInternalEnglish(message) ? GENERIC_MESSAGE : message))

  return [...new Set(messages)]
}
